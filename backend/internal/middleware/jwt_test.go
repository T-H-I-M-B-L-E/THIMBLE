package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"chat-app/internal/config"
)

// withSecret swaps the package's JWT secret for the duration of fn so
// tests can use known values without leaking state into each other.
func withSecret(secret string, fn func()) {
	old := config.JWTSecret()
	config.SetJWTSecret(secret)
	defer func() { config.SetJWTSecret(old) }()
	fn()
}

// ─────────────────────────────────────────────────────────────────────────────
//  GenerateJWT + ValidateJWT (round-trip tests)
// ─────────────────────────────────────────────────────────────────────────────

func TestGenerateAndValidateJWT_RoundTrip(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		token, err := GenerateJWT("user-123", "alice@example.com", 0)
		if err != nil {
			t.Fatalf("GenerateJWT returned error: %v", err)
		}
		claims, err := ValidateJWT(token)
		if err != nil {
			t.Fatalf("ValidateJWT returned error: %v", err)
		}
		if claims.UserID != "user-123" {
			t.Errorf("expected UserID=%q, got %q", "user-123", claims.UserID)
		}
		if claims.Email != "alice@example.com" {
			t.Errorf("expected Email=%q, got %q", "alice@example.com", claims.Email)
		}
	})
}

func TestValidateJWT_WrongSecret(t *testing.T) {
	withSecret("secret-A-32-chars-minimum!!!!!!", func() {
		token, _ := GenerateJWT("user-999", "x@y.com", 0)
		withSecret("secret-B-32-chars-minimum!!!!!!", func() {
			if _, err := ValidateJWT(token); err == nil {
				t.Error("expected error for wrong secret, got nil")
			}
		})
	})
}

func TestValidateJWT_ExpiredToken(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		claims := &Claims{
			UserID: "user-exp",
			Email:  "exp@test.com",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
				Issuer:    "thimble",
			},
		}
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenStr, _ := tok.SignedString([]byte(config.JWTSecret()))

		if _, err := ValidateJWT(tokenStr); err == nil {
			t.Error("expected error for expired token, got nil")
		}
	})
}

func TestValidateJWT_GarbageString(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		if _, err := ValidateJWT("this.is.not.a.jwt"); err == nil {
			t.Error("expected error for garbage token, got nil")
		}
	})
}

func TestValidateJWT_EmptyString(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		if _, err := ValidateJWT(""); err == nil {
			t.Error("expected error for empty token, got nil")
		}
	})
}

// ─────────────────────────────────────────────────────────────────────────────
//  RequireJWT middleware (in-process HTTP tests)
// ─────────────────────────────────────────────────────────────────────────────

func newFiberApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/protected", RequireJWT, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"userId": c.Locals("userId"),
			"email":  c.Locals("email"),
		})
	})
	return app
}

func doRequest(app *fiber.App, method, path string, headers map[string]string) *http.Response {
	req := httptest.NewRequest(method, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, _ := app.Test(req, -1)
	return resp
}

func TestJWTAuth_ValidBearerToken(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		app := newFiberApp()
		token, _ := GenerateJWT("user-42", "b@c.com", 0)
		resp := doRequest(app, "GET", "/protected", map[string]string{
			"Authorization": "Bearer " + token,
		})
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}
		var body map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&body)
		if body["userId"] != "user-42" {
			t.Errorf("expected userId=user-42, got %v", body["userId"])
		}
	})
}

func TestJWTAuth_ValidCookieToken(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		app := newFiberApp()
		token, _ := GenerateJWT("user-99", "c@d.com", 0)
		req := httptest.NewRequest("GET", "/protected", nil)
		req.AddCookie(&http.Cookie{Name: "auth_token", Value: token})
		resp, _ := app.Test(req, -1)
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}
	})
}

func TestJWTAuth_NoToken(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		app := newFiberApp()
		resp := doRequest(app, "GET", "/protected", nil)
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		app := newFiberApp()
		claims := &Claims{
			UserID: "user-old",
			Email:  "old@test.com",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
				Issuer:    "thimble",
			},
		}
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenStr, _ := tok.SignedString([]byte(config.JWTSecret()))
		resp := doRequest(app, "GET", "/protected", map[string]string{
			"Authorization": "Bearer " + tokenStr,
		})
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})
}

func TestJWTAuth_WrongSecret(t *testing.T) {
	withSecret("server-secret-32-chars-minimum!!", func() {
		app := newFiberApp()
		// Forge a token signed with a different key
		attackerClaims := &Claims{
			UserID: "evil",
			Email:  "evil@evil.com",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, attackerClaims)
		tokenStr, _ := tok.SignedString([]byte("attacker-secret-32-chars-min!!"))
		resp := doRequest(app, "GET", "/protected", map[string]string{
			"Authorization": "Bearer " + tokenStr,
		})
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})
}

func TestJWTAuth_MalformedBearerHeader(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		app := newFiberApp()
		// "Bearer" without a token value
		resp := doRequest(app, "GET", "/protected", map[string]string{
			"Authorization": "Bearer",
		})
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", resp.StatusCode)
		}
	})
}

// ─────────────────────────────────────────────────────────────────────────────
//  Benchmarks
// ─────────────────────────────────────────────────────────────────────────────

func BenchmarkGenerateJWT(b *testing.B) {
	config.SetJWTSecret("bench-secret-32-chars-minimum!!")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = GenerateJWT(fmt.Sprintf("user-%d", i), "bench@test.com", 0)
	}
}

func BenchmarkValidateJWT(b *testing.B) {
	config.SetJWTSecret("bench-secret-32-chars-minimum!!")
	token, _ := GenerateJWT("user-bench", "bench@test.com", 0)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = ValidateJWT(token)
	}
}
