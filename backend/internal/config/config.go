package config

import (
	"log"
	"os"
)

// Config holds environment-derived settings loaded once at startup.
type Config struct {
	JWTSecret      string
	ResendKey      string
	DatabaseURL    string
	AllowedOrigins string
	Port           string
	Environment    string
}

var current Config

// Load reads required and optional env vars, exits the process if any
// required value is missing, and returns the populated Config.
func Load() Config {
	jwt := os.Getenv("JWT_SECRET")
	if jwt == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	resend := os.Getenv("RESEND_API_KEY")
	if resend == "" {
		log.Fatal("RESEND_API_KEY environment variable is required")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://localhost:5432/thimble_chat"
	}
	origins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000,https://tvimble.tech,https://admin.tvimble.com,https://admin.tvimble.tech"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	current = Config{
		JWTSecret:      jwt,
		ResendKey:      resend,
		DatabaseURL:    dbURL,
		AllowedOrigins: origins,
		Port:           port,
		Environment:    os.Getenv("ENVIRONMENT"),
	}
	return current
}

// Get returns the most recent Config loaded via Load. Callers must call
// Load() during startup before invoking Get().
func Get() Config { return current }

// JWTSecret is exposed mutably because the auth_test.go suite swaps it in
// and out via withSecret. New tests in internal/middleware can do the same.
func JWTSecret() string         { return current.JWTSecret }
func SetJWTSecret(s string)     { current.JWTSecret = s }
func ResendKey() string         { return current.ResendKey }
func IsProduction() bool        { return current.Environment == "production" }
