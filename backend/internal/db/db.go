package db

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool is the process-wide Postgres connection pool. Initialised once in
// main via Init().
var Pool *pgxpool.Pool

// Init opens the pool against connStr and stores it in the package-level
// Pool variable so every other package can reach it without dependency
// wiring. Returns a cleanup function the caller should defer.
func Init(ctx context.Context, connStr string) func() {
	p, err := pgxpool.New(ctx, connStr)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	Pool = p
	return func() { p.Close() }
}
