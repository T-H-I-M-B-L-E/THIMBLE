package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// RunMigrations applies any SQL files in ./migrations/ that haven't been
// run yet. Files must be named NNN_description.sql (e.g. 001_initial.sql).
// Applied versions are tracked in the schema_migrations table.
func RunMigrations(ctx context.Context) {
	_, err := Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create schema_migrations table: %v", err)
	}

	matches, err := filepath.Glob("migrations/*.sql")
	if err != nil {
		log.Fatalf("Failed to list migration files: %v", err)
	}
	sort.Strings(matches)

	for _, path := range matches {
		version := strings.TrimSuffix(filepath.Base(path), ".sql")

		var exists bool
		Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
		if exists {
			continue
		}

		sql, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("Failed to read migration %s: %v", path, err)
		}
		if _, err = Pool.Exec(ctx, string(sql)); err != nil {
			log.Fatalf("Migration %s failed: %v", version, err)
		}
		if _, err = Pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
			log.Fatalf("Failed to record migration %s: %v", version, err)
		}
		fmt.Printf("✓ Applied migration: %s\n", version)
	}
}
