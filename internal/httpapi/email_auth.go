package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"votely/internal/store"
)



type emailRequestPayload struct {
	Email string `json:"email"`
}

type emailVerifyPayload struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func (s *apiServer) emailRequest(w http.ResponseWriter, r *http.Request) {
	var req emailRequestPayload
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || !isValidEmail(email) {
		writeError(w, http.StatusBadRequest, "bad_email", "Введите корректный email")
		return
	}

	code, codeHash, expiresAt, err := s.generateEmailCode(email)
	if err != nil {
		s.logger.Error("email request generate code failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось отправить код")
		return
	}

	// Сохраняем код в БД
	if err := s.store.SaveEmailCode(r.Context(), email, codeHash, expiresAt); err != nil {
		s.logger.Error("email request save code failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось сохранить код")
		return
	}

	// Если SMTP настроен — отправляем email
	if s.smtpHost != "" && s.smtpFrom != "" {
		if err := s.sendEmailCode(email, code); err != nil {
			s.logger.Error("email request send email failed", "error", err)
			writeError(w, http.StatusInternalServerError, "internal_error", "Не удалось отправить код на почту")
			return
		}
		// В production не возвращаем код
		writeJSON(w, http.StatusOK, map[string]any{"success": true})
	} else {
		// Dev-режим без SMTP: возвращаем код для отладки
		s.logger.Warn("SMTP not configured, returning dev_code (development mode)")
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "dev_code": code})
	}
}

func (s *apiServer) emailVerify(w http.ResponseWriter, r *http.Request) {

	var req emailVerifyPayload
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	code := strings.TrimSpace(req.Code)

	if email == "" || !isValidEmail(email) {
		writeError(w, http.StatusBadRequest, "bad_email", "Введите корректный email")
		return
	}
	if !isValidEmailCode(code) {
		writeError(w, http.StatusBadRequest, "bad_code", "Код состоит из 6 цифр")
		return
	}

	user, err := s.verifyEmailCodeAndCreateSession(r.Context(), email, code, w, r)
	if err != nil {
		s.logger.Error("email verify failed", "error", err)
		writeError(w, http.StatusBadRequest, "email_verify_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "user": user})
}

func (s *apiServer) sendEmailCode(to, code string) error {
	subject := "Код подтверждения для входа в Votely"
	body := fmt.Sprintf(`Здравствуйте!

Ваш код для входа: %s

Код действителен 6 минут.
Если вы не запрашивали вход, проигнорируйте это письмо.

С уважением,
Команда Votely`, code)

	msg := []byte("From: " + s.smtpFrom + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" +
		body + "\r\n")

	addr := s.smtpHost + ":" + s.smtpPort
	auth := smtp.PlainAuth("", s.smtpUser, s.smtpPassword, s.smtpHost)

	// Пытаемся отправить с TLS (порт 587)
	err := smtp.SendMail(addr, auth, s.smtpFrom, []string{to}, msg)
	if err != nil {
		return fmt.Errorf("smtp send failed: %w", err)
	}

	return nil
}

func (s *apiServer) generateEmailCode(_ string) (code string, codeHash string, expiresAt time.Time, err error) {
	// Dev/local flow: return dev_code without DB persistence.
	// This matches the current frontend expectation.
	codeBytes := make([]byte, 4)
	if _, err := rand.Read(codeBytes); err != nil {
		return "", "", time.Time{}, err
	}
	n := int(codeBytes[0])<<16 | int(codeBytes[1])<<8 | int(codeBytes[2])
	codeNum := n % 1000000
	code = fmt.Sprintf("%06d", codeNum)

	codeHash = keyedEmailCodeHash(s.hashSecret, code)
	expiresAt = time.Now().Add(6 * time.Minute)
	return code, codeHash, expiresAt, nil
}

func (s *apiServer) verifyEmailCodeAndCreateSession(ctx context.Context, email string, code string, w http.ResponseWriter, r *http.Request) (store.TelegramUser, error) {
	// Проверяем код в БД
	codeRecord, err := s.store.GetEmailCode(ctx, email)
	if err != nil {
		return store.TelegramUser{}, fmt.Errorf("код не найден, запросите новый")
	}

	// Проверяем попытки
	if codeRecord.Attempts >= 5 {
		return store.TelegramUser{}, fmt.Errorf("слишком много попыток, запросите новый код")
	}

	// Проверяем истечение срока
	if time.Now().After(codeRecord.ExpiresAt) {
		return store.TelegramUser{}, fmt.Errorf("код истёк, запросите новый")
	}

	// Вычисляем хэш введённого кода и сравниваем
	inputCodeHash := keyedEmailCodeHash(s.hashSecret, code)
	if !hmac.Equal([]byte(codeRecord.CodeHash), []byte(inputCodeHash)) {
		// Увеличиваем счётчик попыток
		if err := s.store.IncrementEmailCodeAttempts(ctx, email); err != nil {
			s.logger.Warn("failed to increment code attempts", "error", err)
		}
		return store.TelegramUser{}, fmt.Errorf("неверный код")
	}

	// Код верный — удаляем его из БД
	if err := s.store.DeleteEmailCode(ctx, email); err != nil {
		s.logger.Warn("failed to delete used code", "error", err)
	}

	// Находим или создаём пользователя с этим email
	user, err := s.store.GetOrCreateEmailUser(ctx, email)
	if err != nil {
		return store.TelegramUser{}, fmt.Errorf("не удалось создать пользователя: %w", err)
	}

	// Создаём сессию
	token, err := randomHex(32)
	if err != nil {
		return store.TelegramUser{}, err
	}
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	if err := s.store.CreateSession(ctx, user.ID, keyedHash(s.hashSecret, "session:"+token), expiresAt); err != nil {
		return store.TelegramUser{}, err
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





func keyedEmailCodeHash(secret, code string) string {
	mac := sha256.Sum256([]byte(secret + ":email-code:" + code))
	return hex.EncodeToString(mac[:])
}

func isValidEmail(email string) bool {
	// minimal validation; backend can still reject by SQL.
	return strings.Contains(email, "@") && strings.Contains(email, ".") && len(email) <= 254
}

func isValidEmailCode(code string) bool {
	if len(code) != 6 {
		return false
	}
	for _, r := range code {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

