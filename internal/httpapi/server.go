package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"votely/internal/store"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

const (
	maxSearchQueryLength = 100
	voterCookieName      = "votely_voter"
	sessionCookieName    = "votely_session"
	voterCookieMaxAge    = 60 * 60 * 24 * 365
	maxStoredValueLength = 2048
	maxStoredShortLength = 256
)

var adminTelegramUsers = map[int64]struct{}{
	6725709823: {},
	6357965364: {},
	8415321014: {},
}

type ServerConfig struct {
	Addr                string
	StaticDir           string
	Store               *store.Store
	Logger              *slog.Logger
	HashSecret          string
	TelegramBotToken    string
	TelegramBotUsername string
}

func NewServer(cfg ServerConfig) *http.Server {
	api := &apiServer{store: cfg.Store, logger: cfg.Logger, hashSecret: cfg.HashSecret, telegramBotToken: cfg.TelegramBotToken, telegramBotUsername: cfg.TelegramBotUsername}
	limiter := newRateLimiter(120, time.Minute)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", api.health)
	mux.HandleFunc("GET /api/v1/polls", api.listPolls)
	mux.HandleFunc("GET /api/v1/me/polls", api.listMyPolls)
	mux.HandleFunc("POST /api/v1/polls", api.createPoll)
	mux.HandleFunc("GET /api/v1/polls/{id}", api.getPoll)
	mux.HandleFunc("POST /api/v1/polls/{id}/visits", api.recordPollVisit)
	mux.HandleFunc("POST /api/v1/polls/{id}/votes", api.votePoll)
	mux.HandleFunc("GET /api/v1/polls/{id}/stats", api.pollStats)
	mux.HandleFunc("GET /api/v1/polls/{id}/links", api.pollShareLinks)
	mux.HandleFunc("POST /api/v1/polls/{id}/links", api.createPollShareLink)
	mux.HandleFunc("DELETE /api/v1/polls/{id}/links/{link_id}", api.deletePollShareLink)
	mux.HandleFunc("DELETE /api/v1/polls/{id}", api.adminOnly(api.deletePoll, true))
	mux.HandleFunc("GET /api/v1/quizzes", api.listQuizzes)
	mux.HandleFunc("POST /api/v1/quizzes", api.createQuiz)
	mux.HandleFunc("GET /api/v1/quizzes/{id}", api.getQuiz)
	mux.HandleFunc("POST /api/v1/quizzes/{id}/answers", api.submitQuizAnswer)
	mux.HandleFunc("DELETE /api/v1/quizzes/{id}", api.adminOnly(api.deleteQuiz, true))
	mux.HandleFunc("GET /api/v1/auth/me", api.authMe)
	mux.HandleFunc("GET /api/v1/auth/telegram/config", api.telegramConfig)
	mux.HandleFunc("POST /api/v1/auth/telegram", api.telegramAuth)
	mux.HandleFunc("POST /api/v1/auth/register", api.emailRegister)
	mux.HandleFunc("POST /api/v1/auth/login", api.emailLogin)
	mux.HandleFunc("POST /api/v1/auth/logout", api.authLogout)
	mux.HandleFunc("GET /api/v1/admin/me", api.adminMe)
	mux.HandleFunc("GET /api/v1/admin/summary", api.adminOnly(api.adminSummary, false))
	mux.HandleFunc("GET /api/v1/admin/items", api.adminOnly(api.adminItems, false))
	mux.HandleFunc("DELETE /api/v1/admin/polls/{id}", api.adminOnly(api.deletePoll, true))
	mux.HandleFunc("DELETE /api/v1/admin/quizzes/{id}", api.adminOnly(api.deleteQuiz, true))
	mux.HandleFunc("GET /admin.php", api.adminPage(cfg.StaticDir))
	mux.HandleFunc("GET /admin.html", api.adminPage(cfg.StaticDir))
	mux.Handle("GET /", staticHandler(cfg.StaticDir))

	return &http.Server{
		Addr:              cfg.Addr,
		Handler:           withRecovery(cfg.Logger, withRequestLog(cfg.Logger, withSecurityHeaders(api.withTrafficEvents(limiter.middleware(mux))))),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
}

type apiServer struct {
	store               *store.Store
	logger              *slog.Logger
	hashSecret          string
	telegramBotToken    string
	telegramBotUsername string
}

func (s *apiServer) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *apiServer) listPolls(w http.ResponseWriter, r *http.Request) {
	query, err := searchQuery(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	items, err := s.store.ListPolls(r.Context(), query)
	if err != nil {
		s.logger.Error("list polls failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить опросы.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *apiServer) createPoll(w http.ResponseWriter, r *http.Request) {
	var req createPollRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	ownerKey, err := randomHex(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать ключ владельца.")
		return
	}
	userID := s.sessionUserID(r)
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "auth_required", "Войдите через Telegram, чтобы создать опрос.")
		return
	}
	input, err := req.toInput(userID, userID, keyedHash(s.hashSecret, "owner:"+ownerKey))
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	created, err := s.store.CreatePoll(r.Context(), input)
	if err != nil {
		s.logger.Error("create poll failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать опрос.")
		return
	}
	created.OwnerKey = ownerKey
	writeJSON(w, http.StatusCreated, created)
}

func (s *apiServer) getPoll(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	ownerKeyHash := s.ownerKeyHash(r)
	visible, _, err := s.store.PollAccess(r.Context(), id, ownerKeyHash, s.sessionUserID(r), isAdminUser(s.sessionUserID(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Опрос не найден.")
		return
	}
	if err != nil {
		s.logger.Error("poll access failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось проверить доступ.")
		return
	}
	if !visible {
		writeError(w, http.StatusForbidden, "forbidden", "Опрос доступен только по приватной ссылке.")
		return
	}
	poll, err := s.store.GetPoll(r.Context(), id, s.sessionUserID(r), ownerKeyHash, isAdminUser(s.sessionUserID(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Опрос не найден.")
		return
	}
	if err != nil {
		s.logger.Error("get poll failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить опрос.")
		return
	}
	writeJSON(w, http.StatusOK, poll)
}

func (s *apiServer) recordPollVisit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	visible, _, err := s.store.PollAccess(r.Context(), id, s.ownerKeyHash(r), s.sessionUserID(r), isAdminUser(s.sessionUserID(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Опрос не найден.")
		return
	}
	if err != nil {
		s.logger.Error("poll visit access failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось проверить доступ.")
		return
	}
	if !visible {
		writeError(w, http.StatusForbidden, "forbidden", "Опрос доступен только по приватной ссылке.")
		return
	}
	s.recordTrafficEvent(r, "visit", id, "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *apiServer) listMyPolls(w http.ResponseWriter, r *http.Request) {
	userID := s.sessionUserID(r)
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "auth_required", "Войдите через Telegram, чтобы открыть свои опросы.")
		return
	}
	items, err := s.store.ListUserPolls(r.Context(), userID)
	if err != nil {
		s.logger.Error("list user polls failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить ваши опросы.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *apiServer) votePoll(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	var req votePollRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if !uuidPattern.MatchString(req.OptionID) {
		writeError(w, http.StatusBadRequest, "invalid_option", "Выберите вариант ответа.")
		return
	}
	identity, err := s.voteIdentity(w, r)
	if err != nil {
		s.logger.Error("vote identity failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось проверить голос.")
		return
	}
	result, err := s.store.VotePoll(r.Context(), id, req.OptionID, identity)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Вариант не найден.")
		return
	}
	if errors.Is(err, store.ErrDuplicateVote) {
		writeError(w, http.StatusConflict, "duplicate_vote", "Вы уже голосовали в этом опросе.")
		return
	}
	if errors.Is(err, store.ErrPollClosed) {
		writeError(w, http.StatusConflict, "poll_closed", "Голосование уже завершено.")
		return
	}
	if errors.Is(err, store.ErrCountryNotAllowed) {
		writeError(w, http.StatusForbidden, "country_not_allowed", "Голосование недоступно для вашей страны.")
		return
	}
	if err != nil {
		s.logger.Error("vote poll failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось сохранить голос.")
		return
	}
	s.recordTrafficEvent(r, "vote", id, req.OptionID)
	writeJSON(w, http.StatusOK, result)
}

func (s *apiServer) pollStats(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	ownerKeyHash := s.ownerKeyHash(r)
	userID := s.sessionUserID(r)

	stats, err := s.store.PollStats(r.Context(), id, ownerKeyHash, userID, isAdminUser(userID))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusForbidden, "forbidden", "Статистика доступна владельцу опроса.")
		return
	}
	if err != nil {
		s.logger.Error("poll stats failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить статистику.")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *apiServer) pollShareLinks(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	if !s.canManagePoll(r, id) {
		writeError(w, http.StatusForbidden, "forbidden", "Ссылки доступны владельцу опроса.")
		return
	}
	items, err := s.store.PollShareLinks(r.Context(), id)
	if err != nil {
		s.logger.Error("poll links failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить ссылки.")
		return
	}
	for i := range items {
		items[i].URL = s.pollLinkURL(r, id, items[i].Slug)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *apiServer) createPollShareLink(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	if !s.canManagePoll(r, id) {
		writeError(w, http.StatusForbidden, "forbidden", "Ссылки может создавать только владелец опроса.")
		return
	}
	var req createShareLinkRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	input, err := req.toInput(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	item, err := s.store.CreatePollShareLink(r.Context(), input)
	if err != nil {
		s.logger.Error("create poll link failed", "error", err)
		writeError(w, http.StatusConflict, "link_exists", "Ссылка с таким названием уже есть.")
		return
	}
	item.URL = s.pollLinkURL(r, id, item.Slug)
	writeJSON(w, http.StatusCreated, item)
}

func (s *apiServer) deletePollShareLink(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	linkID := r.PathValue("link_id")
	if !uuidPattern.MatchString(id) || !uuidPattern.MatchString(linkID) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	if !s.canManagePoll(r, id) {
		writeError(w, http.StatusForbidden, "forbidden", "Ссылки может удалять только владелец опроса.")
		return
	}
	if err := s.store.DeletePollShareLink(r.Context(), id, linkID); errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Ссылка не найдена.")
		return
	} else if err != nil {
		s.logger.Error("delete poll link failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось удалить ссылку.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *apiServer) voteIdentity(w http.ResponseWriter, r *http.Request) (store.VoteIdentity, error) {
	token, err := s.voterToken(w, r)
	if err != nil {
		return store.VoteIdentity{}, err
	}
	ip, err := clientIP(r.RemoteAddr)
	if err != nil {
		return store.VoteIdentity{}, err
	}
	device := deviceFingerprint(r)
	geo := ipGeo(r, ip)
	return store.VoteIdentity{
		TelegramUserID: s.sessionUserID(r),
		VoterTokenHash: keyedHash(s.hashSecret, "voter-token:"+token),
		IPHash:         keyedHash(s.hashSecret, "ip:"+ip),
		DeviceHash:     keyedHash(s.hashSecret, "device:"+device),
		Country:        geo.country,
	}, nil
}

func (s *apiServer) withTrafficEvents(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
		if !shouldRecordTrafficEvent(r) {
			return
		}
		s.recordTrafficEvent(r, "visit", "", "")
	})
}

func shouldRecordTrafficEvent(r *http.Request) bool {
	if r.Method != http.MethodGet || strings.HasPrefix(r.URL.Path, "/api/") {
		return false
	}
	ext := filepath.Ext(r.URL.Path)
	return ext == "" || ext == ".html" || ext == ".php"
}

func (s *apiServer) recordTrafficEvent(r *http.Request, eventType, pollID, optionID string) {
	event, err := s.trafficEvent(r, eventType, pollID, optionID)
	if err != nil {
		s.logger.Warn("traffic event skipped", "error", err)
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := s.store.RecordTrafficEvent(ctx, event); err != nil {
			s.logger.Warn("traffic event failed", "error", err)
		}
	}()
}

func (s *apiServer) trafficEvent(r *http.Request, eventType, pollID, optionID string) (store.TrafficEvent, error) {
	ip, err := clientIP(r.RemoteAddr)
	if err != nil {
		return store.TrafficEvent{}, err
	}
	tokenHash := ""
	if cookie, err := r.Cookie(voterCookieName); err == nil {
		if token, ok := verifySignedVoterToken(s.hashSecret, cookie.Value); ok {
			tokenHash = keyedHash(s.hashSecret, "voter-token:"+token)
		}
	}
	geo := ipGeo(r, ip)
	query := r.URL.Query()
	if pollID == "" {
		pollID = query.Get("id")
	}
	shareLinkID := ""
	if uuidPattern.MatchString(pollID) {
		if slug := strings.TrimSpace(query.Get("link")); slug != "" {
			if link, err := s.store.PollShareLinkBySlug(r.Context(), pollID, slug); err == nil {
				shareLinkID = link.ID
			}
		}
	}
	return store.TrafficEvent{
		EventType:      eventType,
		Path:           limitStoredValue(r.URL.Path),
		Method:         r.Method,
		PollID:         safeUUID(pollID),
		OptionID:       optionID,
		VoterTokenHash: tokenHash,
		IPHash:         keyedHash(s.hashSecret, "ip:"+ip),
		DeviceHash:     keyedHash(s.hashSecret, "device:"+deviceFingerprint(r)),
		UserAgent:      limitStoredValue(r.UserAgent()),
		Referrer:       limitStoredValue(r.Referer()),
		LandingURL:     limitStoredValue(requestURL(r)),
		UTMSource:      limitStoredShortValue(query.Get("utm_source")),
		UTMMedium:      limitStoredShortValue(query.Get("utm_medium")),
		UTMCampaign:    limitStoredShortValue(query.Get("utm_campaign")),
		UTMTerm:        limitStoredShortValue(query.Get("utm_term")),
		UTMContent:     limitStoredShortValue(query.Get("utm_content")),
		ShareLinkID:    shareLinkID,
		IPCountry:      geo.country,
		IPRegion:       geo.region,
		IPCity:         geo.city,
		IPGeoSource:    geo.source,
		AcceptLanguage: limitStoredShortValue(r.Header.Get("Accept-Language")),
	}, nil
}

func (s *apiServer) listQuizzes(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListQuizzes(r.Context())
	if err != nil {
		s.logger.Error("list quizzes failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить викторины.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *apiServer) createQuiz(w http.ResponseWriter, r *http.Request) {
	var req createQuizRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	ownerKey, err := randomHex(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать ключ владельца.")
		return
	}
	userID := s.sessionUserID(r)
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "auth_required", "Войдите через Telegram, чтобы создать викторину.")
		return
	}
	input, err := req.toInput(userID, keyedHash(s.hashSecret, "owner:"+ownerKey))
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	created, err := s.store.CreateQuiz(r.Context(), input)
	if err != nil {
		s.logger.Error("create quiz failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать викторину.")
		return
	}
	created.OwnerKey = ownerKey
	writeJSON(w, http.StatusCreated, created)
}

func (s *apiServer) telegramConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":      s.telegramBotToken != "" && s.telegramBotUsername != "",
		"bot_username": s.telegramBotUsername,
	})
}

func (s *apiServer) authMe(w http.ResponseWriter, r *http.Request) {
	userID := s.sessionUserID(r)
	if userID == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	user, err := s.store.TelegramUser(r.Context(), userID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	if err != nil {
		s.logger.Error("telegram user lookup failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить пользователя.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": true, "user": user, "is_admin": isAdminUser(user.ID)})
}

func (s *apiServer) telegramAuth(w http.ResponseWriter, r *http.Request) {
	if s.telegramBotToken == "" {
		writeError(w, http.StatusServiceUnavailable, "telegram_not_configured", "Telegram авторизация не настроена.")
		return
	}
	var req telegramAuthPayload
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	// Build map[string]string for HMAC verification.
	// id and auth_date are int64 → string via strconv.
	// Optional fields (last_name, username, photo_url) are only included
	// when present in the JSON — Telegram omits them from the hash if the
	// user has no last name / username / photo.
	payload := map[string]string{
		"id":         strconv.FormatInt(req.ID, 10),
		"auth_date":  strconv.FormatInt(req.AuthDate, 10),
		"first_name": req.FirstName,
		"hash":       req.Hash,
	}
	if req.LastName != nil {
		payload["last_name"] = *req.LastName
	}
	if req.Username != nil {
		payload["username"] = *req.Username
	}
	if req.PhotoURL != nil {
		payload["photo_url"] = *req.PhotoURL
	}

	if !s.verifyTelegramLogin(payload, s.telegramBotToken) {
		s.logger.Error("telegram auth: signature verification failed", "payload", fmt.Sprintf("%v", payload))
		writeError(w, http.StatusUnauthorized, "invalid_telegram_auth", "Telegram подпись не прошла проверку.")
		return
	}
	if req.ID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid_telegram_user", "Некорректный Telegram ID.")
		return
	}
	user := store.TelegramUser{
		ID:        req.ID,
		FirstName: req.FirstName,
		LastName:  derefStr(req.LastName),
		Username:  derefStr(req.Username),
		PhotoURL:  derefStr(req.PhotoURL),
		AuthDate:  time.Unix(req.AuthDate, 0),
	}
	if err := s.store.UpsertTelegramUser(r.Context(), user); err != nil {
		s.logger.Error("telegram user upsert failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось сохранить пользователя.")
		return
	}
	_, err := s.createAuthSession(w, r, user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать сессию.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":         user.ID,
		"username":   user.Username,
		"first_name": user.FirstName,
		"photo_url":  user.PhotoURL,
	})
}

func (s *apiServer) emailRegister(w http.ResponseWriter, r *http.Request) {
	var req emailAuthRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	name, email, password, err := validateEmailAuth(req, true)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать аккаунт.")
		return
	}
	user, err := s.store.CreateEmailUser(r.Context(), name, email, string(hash))
	if err != nil {
		s.logger.Error("email register failed", "error", err)
		writeError(w, http.StatusConflict, "email_exists", "Пользователь с такой почтой уже существует.")
		return
	}
	s.createAuthSession(w, r, user)
}

func (s *apiServer) emailLogin(w http.ResponseWriter, r *http.Request) {
	var req emailAuthRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	_, email, password, err := validateEmailAuth(req, false)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	emailUser, err := s.store.EmailUser(r.Context(), email)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Неверная почта или пароль.")
		return
	}
	if err != nil {
		s.logger.Error("email login lookup failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось выполнить вход.")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(emailUser.PasswordHash), []byte(password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Неверная почта или пароль.")
		return
	}
	s.createAuthSession(w, r, emailUser.User)
}

func (s *apiServer) createAuthSession(w http.ResponseWriter, r *http.Request, user store.TelegramUser) (store.TelegramUser, error) {
	token, err := randomHex(32)
	if err != nil {
		return user, errors.New("Не удалось создать сессию.")
	}
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	if err := s.store.CreateSession(r.Context(), user.ID, keyedHash(s.hashSecret, "session:"+token), expiresAt); err != nil {
		s.logger.Error("session create failed", "error", err)
		return user, errors.New("Не удалось создать сессию.")
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    signVoterToken(s.hashSecret, token),
		Path:     "/",
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return user, nil
}

func (s *apiServer) authLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *apiServer) getQuiz(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	quiz, err := s.store.GetQuiz(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Викторина не найдена.")
		return
	}
	if err != nil {
		s.logger.Error("get quiz failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить викторину.")
		return
	}
	writeJSON(w, http.StatusOK, quiz)
}

func (s *apiServer) submitQuizAnswer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Некорректный ID.")
		return
	}
	userID := s.sessionUserID(r)
	if userID == 0 {
		writeError(w, http.StatusUnauthorized, "auth_required", "Войдите через Telegram, чтобы пройти викторину.")
		return
	}
	var req submitQuizAnswerRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if !uuidPattern.MatchString(req.AnswerID) {
		writeError(w, http.StatusBadRequest, "invalid_answer", "Выберите вариант ответа.")
		return
	}
	result, err := s.store.SubmitQuizAnswer(r.Context(), id, req.AnswerID, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Вариант не найден.")
		return
	}
	if errors.Is(err, store.ErrDuplicateVote) {
		writeError(w, http.StatusConflict, "duplicate_vote", "Вы уже проходили эту викторину.")
		return
	}
	if err != nil {
		s.logger.Error("submit quiz answer failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось сохранить ответ.")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

type sqlRequest struct {
	Query string `json:"query"`
}

func (s *apiServer) adminOnly(next http.HandlerFunc, requireCSRF bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := s.sessionUserID(r)
		if !isAdminUser(userID) {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Доступ запрещен.")
			return
		}
		if requireCSRF && !s.validAdminCSRF(r) {
			writeError(w, http.StatusForbidden, "csrf_failed", "Сессия устарела, обновите страницу.")
			return
		}
		next(w, r)
	}
}

func (s *apiServer) adminPage(staticDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isAdminUser(s.sessionUserID(r)) {
			http.Redirect(w, r, "/index.php", http.StatusFound)
			return
		}
		http.ServeFile(w, r, filepath.Join(staticDir, filepath.Base(r.URL.Path)))
	}
}

func (s *apiServer) ownerKeyHash(r *http.Request) string {
	ownerKey := strings.TrimSpace(r.URL.Query().Get("owner_key"))
	if ownerKey == "" {
		return ""
	}
	return keyedHash(s.hashSecret, "owner:"+ownerKey)
}

func (s *apiServer) canManagePoll(r *http.Request, pollID string) bool {
	userID := s.sessionUserID(r)
	_, owner, err := s.store.PollAccess(r.Context(), pollID, s.ownerKeyHash(r), userID, isAdminUser(userID))
	return err == nil && owner
}

func (s *apiServer) pollLinkURL(r *http.Request, pollID, slug string) string {
	return absoluteBaseURL(r) + "/view.php?type=poll&id=" + pollID + "&link=" + slug + "&utm_source=" + slug + "&utm_medium=named"
}

func (s *apiServer) adminMe(w http.ResponseWriter, r *http.Request) {
	userID := s.sessionUserID(r)
	if !isAdminUser(userID) {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"csrf":          s.adminCSRF(r),
	})
}

func (s *apiServer) adminSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := s.store.AdminSummary(r.Context())
	if err != nil {
		s.logger.Error("admin summary failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить сводку.")
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (s *apiServer) adminItems(w http.ResponseWriter, r *http.Request) {
	itemType := r.URL.Query().Get("type")
	if itemType != "quizzes" {
		itemType = "polls"
	}
	items, err := s.store.AdminItems(r.Context(), itemType)
	if err != nil {
		s.logger.Error("admin items failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось загрузить список.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func isAdminUser(userID int64) bool {
	_, ok := adminTelegramUsers[userID]
	return ok
}

func (s *apiServer) adminCSRF(r *http.Request) string {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return ""
	}
	return keyedHash(s.hashSecret, "admin-csrf:"+cookie.Value)
}

func (s *apiServer) validAdminCSRF(r *http.Request) bool {
	expected := s.adminCSRF(r)
	provided := strings.TrimSpace(r.Header.Get("X-CSRF-Token"))
	return expected != "" && provided != "" && hmac.Equal([]byte(expected), []byte(provided))
}

func staticHandler(staticDir string) http.Handler {
	files := http.FileServer(http.Dir(staticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		if path == "." || path == "" {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}
		files.ServeHTTP(w, r)
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, value any) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return errors.New("Ожидается Content-Type application/json.")
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	// Don't use DisallowUnknownFields — Telegram embed widget may send extra fields
	// that we should ignore rather than reject with 400.
	if err := decoder.Decode(value); err != nil {
		return errors.New("Некорректный JSON.")
	}
	return nil
}

func searchQuery(r *http.Request) (string, error) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		return "", nil
	}
	if strings.ContainsAny(query, "\x00\r\n\t") {
		return "", errors.New("Поисковый запрос содержит недопустимые символы.")
	}
	if len([]rune(query)) > maxSearchQueryLength {
		return "", fmt.Errorf("Поисковый запрос слишком длинный: максимум %d символов.", maxSearchQueryLength)
	}
	return query, nil
}

func (s *apiServer) voterToken(w http.ResponseWriter, r *http.Request) (string, error) {
	if cookie, err := r.Cookie(voterCookieName); err == nil {
		if token, ok := verifySignedVoterToken(s.hashSecret, cookie.Value); ok {
			return token, nil
		}
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)
	http.SetCookie(w, &http.Cookie{
		Name:     voterCookieName,
		Value:    signVoterToken(s.hashSecret, token),
		Path:     "/",
		MaxAge:   voterCookieMaxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return token, nil
}

func (s *apiServer) sessionUserID(r *http.Request) int64 {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return 0
	}
	token, ok := verifySignedVoterToken(s.hashSecret, cookie.Value)
	if !ok {
		return 0
	}
	userID, err := s.store.SessionUserID(r.Context(), keyedHash(s.hashSecret, "session:"+token))
	if err != nil {
		return 0
	}
	return userID
}

func randomHex(size int) (string, error) {
	tokenBytes := make([]byte, size)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(tokenBytes), nil
}

func signVoterToken(secret, token string) string {
	return token + "." + keyedHash(secret, "cookie:"+token)
}

func verifySignedVoterToken(secret, value string) (string, bool) {
	token, signature, ok := strings.Cut(value, ".")
	if !ok || !validVoterToken(token) || len(signature) != 64 {
		return "", false
	}
	expected := keyedHash(secret, "cookie:"+token)
	if !hmac.Equal([]byte(signature), []byte(expected)) {
		return "", false
	}
	return token, true
}

func validVoterToken(value string) bool {
	if len(value) != 64 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func clientIP(remoteAddr string) (string, error) {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(strings.TrimSpace(host))
	if ip == nil {
		return "", errors.New("invalid remote address")
	}
	return ip.String(), nil
}

type geoHint struct {
	country string
	region  string
	city    string
	source  string
}

func ipGeo(r *http.Request, ip string) geoHint {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return geoHint{source: "unknown"}
	}
	if parsed.IsPrivate() || parsed.IsLoopback() || parsed.IsLinkLocalUnicast() || parsed.IsLinkLocalMulticast() {
		return geoHint{source: "private"}
	}
	if country := cleanGeoValue(r.Header.Get("CF-IPCountry")); country != "" && country != "XX" {
		return geoHint{country: country, source: "cf-ipcountry"}
	}
	if country := cleanGeoValue(r.Header.Get("X-Vercel-IP-Country")); country != "" {
		return geoHint{
			country: country,
			region:  cleanGeoValue(r.Header.Get("X-Vercel-IP-Country-Region")),
			city:    cleanGeoValue(r.Header.Get("X-Vercel-IP-City")),
			source:  "vercel-ip-headers",
		}
	}
	if country := cleanGeoValue(r.Header.Get("Fly-Client-IP-Country")); country != "" {
		return geoHint{country: country, source: "fly-ip-headers"}
	}
	return geoHint{source: "unknown"}
}

func cleanGeoValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	value = strings.ReplaceAll(value, "\r", "")
	value = strings.ReplaceAll(value, "\n", "")
	return limitStoredShortValue(value)
}

func requestURL(r *http.Request) string {
	return absoluteBaseURL(r) + r.URL.RequestURI()
}

func absoluteBaseURL(r *http.Request) string {
	scheme := "http"
	if proto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); proto == "http" || proto == "https" {
		scheme = proto
	} else if r.TLS != nil {
		scheme = "https"
	}
	host := r.Host
	if forwardedHost := strings.TrimSpace(r.Header.Get("X-Forwarded-Host")); forwardedHost != "" {
		host = forwardedHost
	}
	return scheme + "://" + host
}

func safeUUID(value string) string {
	if uuidPattern.MatchString(value) {
		return value
	}
	return ""
}

func limitStoredValue(value string) string {
	return limitValue(value, maxStoredValueLength)
}

func limitStoredShortValue(value string) string {
	return limitValue(value, maxStoredShortLength)
}

func limitValue(value string, maxLength int) string {
	value = strings.TrimSpace(value)
	if len(value) <= maxLength {
		return value
	}
	return value[:maxLength]
}

func deviceFingerprint(r *http.Request) string {
	parts := []string{
		r.Header.Get("User-Agent"),
		r.Header.Get("Accept-Language"),
		r.Header.Get("Accept-Encoding"),
		r.Header.Get("Sec-CH-UA"),
		r.Header.Get("Sec-CH-UA-Mobile"),
		r.Header.Get("Sec-CH-UA-Platform"),
		r.Header.Get("X-Device-Fingerprint"),
	}
	return strings.Join(parts, "\n")
}

func keyedHash(secret, value string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *apiServer) verifyTelegramLogin(payload map[string]string, botToken string) bool {
	hashValue := payload["hash"]
	if hashValue == "" {
		s.logger.Debug("telegram auth: missing hash")
		return false
	}

	authUnix, err := strconv.ParseInt(payload["auth_date"], 10, 64)
	if err != nil || time.Since(time.Unix(authUnix, 0)) > 24*time.Hour {
		s.logger.Debug("telegram auth: invalid or expired auth_date", "auth_date", payload["auth_date"])
		return false
	}

	// Build the signed string from all fields except 'hash', sorted by key name.
	keys := make([]string, 0, len(payload)-1)
	for k := range payload {
		if k != "hash" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+payload[k])
	}

	signedString := strings.Join(parts, "\n")
	// Telegram uses SHA256(bot_token) as the HMAC key, not the raw token.
	// See: https://core.telegram.org/widgets/login#checking-authorization
	botToken = strings.TrimSpace(botToken)
	tokenHash := sha256.Sum256([]byte(botToken))

	mac := hmac.New(sha256.New, tokenHash[:])
	_, _ = mac.Write([]byte(signedString))
	expected := hex.EncodeToString(mac.Sum(nil))

	s.logger.Debug("telegram auth check", "expected_hash", expected, "received_hash", hashValue, "token_len", len(botToken))

	return hmac.Equal([]byte(hashValue), []byte(expected))
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{
		"code":    code,
		"message": message,
	})
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://telegram.org 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src https://oauth.telegram.org https://oauth.telegram.com https://telegram.org; connect-src 'self' https://oauth.telegram.org https://oauth.telegram.com https://telegram.org; img-src 'self' https://t.me https://telegram.org data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func withRecovery(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				logger.Error("panic recovered", "error", err)
				writeError(w, http.StatusInternalServerError, "internal_error", "Внутренняя ошибка.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func withRequestLog(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(start).Milliseconds())
	})
}

type rateLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	clients map[string]rateBucket
}

type rateBucket struct {
	count int
	reset time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, clients: make(map[string]rateBucket)}
}

func (l *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") && !l.allow(r.RemoteAddr) {
			writeError(w, http.StatusTooManyRequests, "rate_limited", "Слишком много запросов.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *rateLimiter) allow(remoteAddr string) bool {
	now := time.Now()
	key := remoteAddr
	if index := strings.LastIndex(remoteAddr, ":"); index > 0 {
		key = remoteAddr[:index]
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	bucket := l.clients[key]
	if now.After(bucket.reset) {
		bucket = rateBucket{reset: now.Add(l.window)}
	}
	bucket.count++
	l.clients[key] = bucket
	return bucket.count <= l.limit
}

func (s *apiServer) deletePoll(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.DeletePoll(r.Context(), id); err != nil {
		s.logger.Error("delete poll failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось удалить.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *apiServer) deleteQuiz(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.DeleteQuiz(r.Context(), id); err != nil {
		s.logger.Error("delete quiz failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось удалить.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
