package db

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Init(ctx context.Context, connStr string) func() {
	cfg, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		log.Fatal("Unable to parse database URL:", err)
	}

	cfg.MaxConns = 80

	// MinConns = 0 so the pool holds NO idle connections when traffic stops.
	// This is what lets Neon's compute auto-suspend (it sleeps after ~5 min of
	// no queries). With MinConns > 0 plus a periodic health check, the pool
	// would ping the DB forever and the compute would never sleep — burning the
	// free-tier CU-hour budget 24/7 even with zero users.
	cfg.MinConns = 0

	// Release idle connections well before Neon's ~5 min suspend window so the
	// DB can actually go to sleep between bursts of traffic.
	cfg.MaxConnIdleTime = 90 * time.Second
	cfg.MaxConnLifetime = 30 * time.Minute

	// Long health-check period: with MinConns=0 there are usually no idle conns
	// to check anyway, and we don't want this to be the thing keeping the DB
	// awake. Per-acquire checks still catch dead connections on actual use.
	cfg.HealthCheckPeriod = 10 * time.Minute

	// We connect through Neon's connection pooler (PgBouncer in transaction
	// mode). PgBouncer doesn't support server-side prepared statements across
	// pooled transactions, so disable pgx's prepared-statement cache by using
	// the simple query protocol. Without this, queries fail intermittently
	// under load with "prepared statement already exists".
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	Pool = p
	return func() { p.Close() }
}
