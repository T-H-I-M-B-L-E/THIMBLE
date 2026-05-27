package db

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Init(ctx context.Context, connStr string) func() {
	cfg, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		log.Fatal("Unable to parse database URL:", err)
	}

	cfg.MaxConns = 80
	cfg.MinConns = 2
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 10 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	Pool = p
	return func() { p.Close() }
}
