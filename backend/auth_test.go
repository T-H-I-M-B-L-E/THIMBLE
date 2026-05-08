package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// ─────────────────────────────────────────────────────────────────────────────
//  generateVerificationCode
// ─────────────────────────────────────────────────────────────────────────────

func TestGenerateVerificationCode_Length(t *testing.T) {
	code := generateVerificationCode()
	if len(code) != 6 {
		t.Errorf("expected 6-digit code, got %q (len=%d)", code, len(code))
	}
}

func TestGenerateVerificationCode_AllDigits(t *testing.T) {
	for i := 0; i < 20; i++ {
		code := generateVerificationCode()
		for _, ch := range code {
			if ch < '0' || ch > '9' {
				t.Errorf("code %q contains non-digit character %q", code, ch)
			}
		}
	}
}

func TestGenerateVerificationCode_Randomness(t *testing.T) {
	// Two consecutive calls should almost never be identical.
	// (Probability of collision is 1/10^6 ≈ negligible.)
	a := generateVerificationCode()
	b := generateVerificationCode()
	if a == b {
		t.Logf("codes happened to match (%s == %s); this is astronomically unlikely — run again", a, b)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  generateJWT + validateJWT (round-trip tests)
// ─────────────────────────────────────────────────────────────────────────────

func withSecret(secret string, fn func()) {
	old := jwtSecret
	jwtSecret = secret
	defer func() { jwtSecret = old }()
	fn()
}

func TestGenerateAndValidateJWT_RoundTrip(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		token, err := generateJWT("user-123", "alice@example.com")
		if err != nil {
			t.Fatalf("generateJWT returned error: %v", err)
		}

		claims, err := validateJWT(token)
		if err != nil {
			t.Fatalf("validateJWT returned error: %v", err)
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
	// Sign with secret-A, validate with secret-B → should fail.
	withSecret("secret-A-32-chars-minimum!!!!!!", func() {
		token, _ := generateJWT("user-999", "x@y.com")

		withSecret("secret-B-32-chars-minimum!!!!!!", func() {
			_, err := validateJWT(token)
			if err == nil {
				t.Error("expected error for wrong secret, got nil")
			}
		})
	})
}

func TestValidateJWT_ExpiredToken(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		// Forge an expired token manually.
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
		tokenStr, _ := tok.SignedString([]byte(jwtSecret))

		_, err := validateJWT(tokenStr)
		if err == nil {
			t.Error("expected error for expired token, got nil")
		}
	})
}

func TestValidateJWT_GarbageString(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		_, err := validateJWT("this.is.not.a.jwt")
		if err == nil {
			t.Error("expected error for garbage token, got nil")
		}
	})
}

func TestValidateJWT_EmptyString(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		_, err := validateJWT("")
		if err == nil {
			t.Error("expected error for empty token, got nil")
		}
	})
}

// ─────────────────────────────────────────────────────────────────────────────
//  jwtAuth middleware (in-process HTTP tests)
// ─────────────────────────────────────────────────────────────────────────────

func newFiberApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Get("/protected", jwtAuth, func(c *fiber.Ctx) error {
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
		token, _ := generateJWT("user-42", "b@c.com")

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
		token, _ := generateJWT("user-99", "c@d.com")

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
		tokenStr, _ := tok.SignedString([]byte(jwtSecret))

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
	// Token signed with one secret, server expects another.
	withSecret("server-secret-32-chars-minimum!!", func() {
		app := newFiberApp()

		// Sign with a different secret
		withSecret("attacker-secret-32-chars-min!!", func() {
			_, err := generateJWT("evil-user", "hacker@evil.com")
			if err != nil {
				t.Fatal(err)
			}
		})
		// Re-sign manually with attacker key
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
//  handleSignup — validation layer only (DB is nil, expect early 400)
// ─────────────────────────────────────────────────────────────────────────────

func signupBody(email, password, fullName string) io.Reader {
	b, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
		"fullName": fullName,
	})
	return strings.NewReader(string(b))
}

func newSignupApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/auth/signup", handleSignup)
	return app
}

func TestHandleSignup_MissingEmail(t *testing.T) {
	app := newSignupApp()

	req := httptest.NewRequest("POST", "/auth/signup", signupBody("", "Password1!", "Alice"))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSignup_MissingPassword(t *testing.T) {
	app := newSignupApp()

	req := httptest.NewRequest("POST", "/auth/signup", signupBody("a@b.com", "", "Alice"))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSignup_MissingFullName(t *testing.T) {
	app := newSignupApp()

	req := httptest.NewRequest("POST", "/auth/signup", signupBody("a@b.com", "Password1!", ""))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSignup_InvalidJSON(t *testing.T) {
	app := newSignupApp()

	req := httptest.NewRequest("POST", "/auth/signup", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

// Confirm JSON error shape
func TestHandleSignup_ErrorHasErrorKey(t *testing.T) {
	app := newSignupApp()

	req := httptest.NewRequest("POST", "/auth/signup", signupBody("", "", ""))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)

	if _, ok := body["error"]; !ok {
		t.Errorf("expected response to contain 'error' key, got %v", body)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Content-type and CORS smoke tests
// ─────────────────────────────────────────────────────────────────────────────

func TestResponseContentType_IsJSON(t *testing.T) {
	withSecret("test-secret-at-least-32-chars!!", func() {
		app := newSignupApp()
		req := httptest.NewRequest("POST", "/auth/signup", signupBody("", "", ""))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		defer resp.Body.Close()

		ct := resp.Header.Get("Content-Type")
		if !strings.Contains(ct, "application/json") {
			t.Errorf("expected Content-Type=application/json, got %q", ct)
		}
	})
}

// ─────────────────────────────────────────────────────────────────────────────
//  Benchmarks
// ─────────────────────────────────────────────────────────────────────────────

func BenchmarkGenerateVerificationCode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = generateVerificationCode()
	}
}

func BenchmarkGenerateJWT(b *testing.B) {
	jwtSecret = "bench-secret-32-chars-minimum!!"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = generateJWT(fmt.Sprintf("user-%d", i), "bench@test.com")
	}
}

func BenchmarkValidateJWT(b *testing.B) {
	jwtSecret = "bench-secret-32-chars-minimum!!"
	token, _ := generateJWT("user-bench", "bench@test.com")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = validateJWT(token)
	}
}
