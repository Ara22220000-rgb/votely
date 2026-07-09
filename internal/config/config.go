package config

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
)

type Config struct {
	Addr                string
	DatabaseURL         string
	StaticDir           string
	MigrationsDir       string
	VoteHashSecret      string
	TelegramBotToken    string
	TelegramBotUsername string
	LogLevel            slog.Level
	SMTPHost            string
	SMTPPort            string
	SMTPUser            string
	SMTPPassword        string
	SMTPFrom            string
}

func Load() Config {
	databaseURL := env("DATABASE_URL", "")
	if databaseURL == "" {
		databaseURL = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=disable",
			env("PG_USER", "votely"),
			env("PG_PASSWORD", "votely"),
			env("PG_HOST", "localhost"),
			env("PG_PORT", "5432"),
			env("PG_DB", "votely"),
		)
	}
	hashSecret := env("VOTE_HASH_SECRET", "")
	if hashSecret == "" {
		hashSecret = env("HASH_SECRET", databaseURL)
	}
	return Config{
		Addr:                env("APP_ADDR", ":8080"),
		DatabaseURL:         databaseURL,
		StaticDir:           env("STATIC_DIR", "web"),
		MigrationsDir:       env("MIGRATIONS_DIR", "migrations"),
		VoteHashSecret:      hashSecret,
		TelegramBotToken:    env("TELEGRAM_BOT_TOKEN", ""),
		TelegramBotUsername: env("TELEGRAM_BOT_USERNAME", ""),
		LogLevel:            parseLogLevel(env("LOG_LEVEL", "info")),
		SMTPHost:            env("SMTP_HOST", ""),
		SMTPPort:            env("SMTP_PORT", "587"),
		SMTPUser:            env("SMTP_USER", ""),
		SMTPPassword:        env("SMTP_PASSWORD", ""),
		SMTPFrom:            env("SMTP_FROM", ""),
	}
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func parseLogLevel(value string) slog.Level {
	switch strings.ToLower(value) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
