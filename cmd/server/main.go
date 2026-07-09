package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"votely/internal/config"
	"votely/internal/httpapi"
	"votely/internal/store"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := store.Migrate(ctx, db, cfg.MigrationsDir); err != nil {
		logger.Error("database migration failed", "error", err)
		os.Exit(1)
	}

	app := httpapi.NewServer(httpapi.ServerConfig{
		Addr:                cfg.Addr,
		StaticDir:           cfg.StaticDir,
		Store:               store.New(db),
		Logger:              logger,
		HashSecret:          cfg.VoteHashSecret,
		TelegramBotToken:    cfg.TelegramBotToken,
		TelegramBotUsername: cfg.TelegramBotUsername,
		SMTPHost:            cfg.SMTPHost,
		SMTPPort:            cfg.SMTPPort,
		SMTPUser:            cfg.SMTPUser,
		SMTPPassword:        cfg.SMTPPassword,
		SMTPFrom:            cfg.SMTPFrom,
	})

	errCh := make(chan error, 1)
	go func() {
		logger.Info("server started", "addr", cfg.Addr)
		errCh <- app.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := app.Shutdown(shutdownCtx); err != nil {
			logger.Error("server shutdown failed", "error", err)
			os.Exit(1)
		}
		logger.Info("server stopped")
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}
}
