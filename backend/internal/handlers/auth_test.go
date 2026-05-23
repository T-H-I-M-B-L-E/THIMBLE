package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func signupBody(email, password, fullName string) io.Reader {
	b, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
		"fullName": fullName,
	})
	return strings.NewReader(string(b))
}

// newSignupApp wires only the signup handler so the test can hit it without
// initialising the full router or a database connection.
func newSignupApp() *fiber.App {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	app.Post("/auth/signup", Signup)
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

func TestResponseContentType_IsJSON(t *testing.T) {
	app := newSignupApp()
	req := httptest.NewRequest("POST", "/auth/signup", signupBody("", "", ""))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()
	ct := resp.Header.Get("Content-Type")
	if !strings.Contains(ct, "application/json") {
		t.Errorf("expected Content-Type=application/json, got %q", ct)
	}
}
