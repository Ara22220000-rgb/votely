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
	"io"
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
	mux.HandleFunc("POST /api/v1/polls", api.createPoll)
	mux.HandleFunc("GET /api/v1/polls/{id}", api.getPoll)
	mux.HandleFunc("POST /api/v1/polls/{id}/votes", api.votePoll)
	mux.HandleFunc("GET /api/v1/polls/{id}/stats", api.pollStats)
	mux.HandleFunc("DELETE /api/v1/polls/{id}", api.adminOnly(api.deletePoll))
	mux.HandleFunc("GET /api/v1/quizzes", api.listQuizzes)
	mux.HandleFunc("POST /api/v1/quizzes", api.createQuiz)
	mux.HandleFunc("GET /api/v1/quizzes/{id}", api.getQuiz)
	mux.HandleFunc("DELETE /api/v1/quizzes/{id}", api.adminOnly(api.deleteQuiz))
	mux.HandleFunc("GET /api/v1/auth/telegram/config", api.telegramConfig)
	mux.HandleFunc("POST /api/v1/auth/telegram", api.telegramAuth)
	mux.HandleFunc("POST /api/v1/admin/sql", api.adminOnly(api.executeSQL))
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
	input, err := req.toInput(userID, keyedHash(s.hashSecret, "owner:"+ownerKey))
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
	poll, err := s.store.GetPoll(r.Context(), id)
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
	ownerKey := strings.TrimSpace(r.URL.Query().Get("owner_key"))
	ownerKeyHash := ""
	if ownerKey != "" {
		ownerKeyHash = keyedHash(s.hashSecret, "owner:"+ownerKey)
	}
	stats, err := s.store.PollStats(r.Context(), id, ownerKeyHash, s.sessionUserID(r))
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
	return ext == "" || ext == ".html"
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
	return store.TrafficEvent{
		EventType:      eventType,
		Path:           limitStoredValue(r.URL.Path),
		Method:         r.Method,
		PollID:         pollID,
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

func (s *apiServer) telegramAuth(w http.ResponseWriter, r *http.Request) {
	if s.telegramBotToken == "" {
		writeError(w, http.StatusServiceUnavailable, "telegram_not_configured", "Telegram авторизация не настроена.")
		return
	}
	var payload map[string]string
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if !verifyTelegramLogin(payload, s.telegramBotToken) {
		writeError(w, http.StatusUnauthorized, "invalid_telegram_auth", "Telegram подпись не прошла проверку.")
		return
	}
	userID, err := strconv.ParseInt(payload["id"], 10, 64)
	if err != nil || userID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid_telegram_user", "Некорректный Telegram ID.")
		return
	}
	authUnix, _ := strconv.ParseInt(payload["auth_date"], 10, 64)
	user := store.TelegramUser{
		ID:        userID,
		FirstName: payload["first_name"],
		LastName:  payload["last_name"],
		Username:  payload["username"],
		PhotoURL:  payload["photo_url"],
		AuthDate:  time.Unix(authUnix, 0),
	}
	if err := s.store.UpsertTelegramUser(r.Context(), user); err != nil {
		s.logger.Error("telegram user upsert failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось сохранить пользователя.")
		return
	}
	token, err := randomHex(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать сессию.")
		return
	}
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	if err := s.store.CreateSession(r.Context(), userID, keyedHash(s.hashSecret, "session:"+token), expiresAt); err != nil {
		s.logger.Error("session create failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось создать сессию.")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    signVoterToken(s.hashSecret, token),
		Path:     "/",
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]any{"id": userID, "username": user.Username, "first_name": user.FirstName})
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

type sqlRequest struct {
	Query string `json:"query"`
}

func (s *apiServer) adminOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "admin123" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Доступ запрещен.")
			return
		}
		next(w, r)
	}
}

func (s *apiServer) executeSQL(w http.ResponseWriter, r *http.Request) {
	var req sqlRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return
	}
	if strings.TrimSpace(req.Query) == "" {
		writeError(w, http.StatusBadRequest, "empty_query", "Запрос не может быть пустым.")
		return
	}

	result, err := s.store.ExecuteSQL(r.Context(), req.Query)
	if err != nil {
		s.logger.Error("sql execution failed", "error", err)
		writeError(w, http.StatusInternalServerError, "sql_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
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
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return errors.New("Некорректный JSON.")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("JSON должен содержать только один объект.")
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
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + r.Host + r.URL.RequestURI()
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

func verifyTelegramLogin(payload map[string]string, botToken string) bool {
	hashValue := payload["hash"]
	if hashValue == "" {
		return false
	}
	authUnix, err := strconv.ParseInt(payload["auth_date"], 10, 64)
	if err != nil || time.Since(time.Unix(authUnix, 0)) > 24*time.Hour {
		return false
	}
	keys := make([]string, 0, len(payload))
	for key, value := range payload {
		if key == "hash" || value == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+payload[key])
	}
	secret := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secret[:])
	_, _ = mac.Write([]byte(strings.Join(parts, "\n")))
	expected := hex.EncodeToString(mac.Sum(nil))
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
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://telegram.org; frame-src https://oauth.telegram.org; connect-src 'self'; img-src 'self' https://t.me https://telegram.org data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
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