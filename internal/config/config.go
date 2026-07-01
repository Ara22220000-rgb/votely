package config

import (
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
}

func Load() Config {
	databaseURL := env("DATABASE_URL", "postgres://votely:votely@localhost:5432/votely?sslmode=disable")
	return Config{
		Addr:                env("APP_ADDR", ":8080"),
		DatabaseURL:         databaseURL,
		StaticDir:           env("STATIC_DIR", "web"),
		MigrationsDir:       env("MIGRATIONS_DIR", "migrations"),
		VoteHashSecret:      env("VOTE_HASH_SECRET", databaseURL),
		TelegramBotToken:    env("TELEGRAM_BOT_TOKEN", "8488971818:AAGmksAGkK_zJvEPYlFNAA_oq0-7i17ZulM"),
		TelegramBotUsername: env("TELEGRAM_BOT_USERNAME", "jljibot"),
		LogLevel:            parseLogLevel(env("LOG_LEVEL", "info")),
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
