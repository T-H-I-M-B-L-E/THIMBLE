package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// runMigrations applies any SQL files in ./migrations/ that haven't been run yet.
// Files must be named NNN_description.sql (e.g. 001_initial_schema.sql).
// Migrations are tracked in the schema_migrations table.
func runMigrations(ctx context.Context) {
	_, err := dbPool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create schema_migrations table: %v", err)
	}

	// Find migration files
	matches, err := filepath.Glob("migrations/*.sql")
	if err != nil {
		log.Fatalf("Failed to list migration files: %v", err)
	}
	sort.Strings(matches)

	for _, path := range matches {
		version := strings.TrimSuffix(filepath.Base(path), ".sql")

		var exists bool
		dbPool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
		if exists {
			continue
		}

		sql, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("Failed to read migration %s: %v", path, err)
		}

		_, err = dbPool.Exec(ctx, string(sql))
		if err != nil {
			log.Fatalf("Migration %s failed: %v", version, err)
		}

		_, err = dbPool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", version)
		if err != nil {
			log.Fatalf("Failed to record migration %s: %v", version, err)
		}

		fmt.Printf("✓ Applied migration: %s\n", version)
	}
}
