package services

import (
	"context"
	"testing"

	"chat-app/internal/models"
)

// ── Signup validation (no DB — fails on missing fields before any DB call) ───

func TestSignup_MissingEmail(t *testing.T) {
	err := Signup(context.TODO(), models.SignupRequest{Email: "", Password: "Password1!", FullName: "Alice"})
	requireCode(t, err, 400, "missing_fields")
}

func TestSignup_MissingPassword(t *testing.T) {
	err := Signup(context.TODO(), models.SignupRequest{Email: "a@b.com", Password: "", FullName: "Alice"})
	requireCode(t, err, 400, "missing_fields")
}

func TestSignup_MissingFullName(t *testing.T) {
	err := Signup(context.TODO(), models.SignupRequest{Email: "a@b.com", Password: "Password1!", FullName: ""})
	requireCode(t, err, 400, "missing_fields")
}

func TestSignup_AllFieldsMissing(t *testing.T) {
	err := Signup(context.TODO(), models.SignupRequest{})
	requireCode(t, err, 400, "missing_fields")
}

// ── Login validation ──────────────────────────────────────────────────────────

func TestLogin_MissingEmail(t *testing.T) {
	_, err := Login(context.TODO(), models.LoginRequest{Email: "", Password: "Password1!"})
	requireCode(t, err, 400, "missing_fields")
}

func TestLogin_MissingPassword(t *testing.T) {
	_, err := Login(context.TODO(), models.LoginRequest{Email: "a@b.com", Password: ""})
	requireCode(t, err, 400, "missing_fields")
}

func TestLogin_BothMissing(t *testing.T) {
	_, err := Login(context.TODO(), models.LoginRequest{})
	requireCode(t, err, 400, "missing_fields")
}

// ── ChangePassword validation ─────────────────────────────────────────────────

func TestChangePassword_WeakNewPassword(t *testing.T) {
	err := ChangePassword(context.TODO(), "user-1", "oldpass", "short")
	requireCode(t, err, 400, "weak_password")
}

func TestChangePassword_SevenCharsIsWeak(t *testing.T) {
	err := ChangePassword(context.TODO(), "user-1", "oldpass", "1234567")
	requireCode(t, err, 400, "weak_password")
}

func TestChangePassword_SevenCharsIsWeakBoundary(t *testing.T) {
	// 7 chars is one below the 8-char minimum — must be rejected.
	err := ChangePassword(context.TODO(), "user-1", "oldpass", "1234567")
	requireCode(t, err, 400, "weak_password")
}

// ── ChangeEmail validation ────────────────────────────────────────────────────

func TestChangeEmail_EmptyNewEmail(t *testing.T) {
	err := ChangeEmail(context.TODO(), "user-1", "pass", "")
	requireCode(t, err, 400, "invalid_email")
}

// ── ServiceError ──────────────────────────────────────────────────────────────

func TestServiceError_ErrorReturnsMessage(t *testing.T) {
	e := NewError(400, "some_code", "some message")
	if e.Error() != "some message" {
		t.Errorf("expected %q, got %q", "some message", e.Error())
	}
}

func TestServiceError_ErrorFallsBackToCode(t *testing.T) {
	e := NewError(400, "some_code", "")
	if e.Error() != "some_code" {
		t.Errorf("expected %q, got %q", "some_code", e.Error())
	}
}

func TestNewError_DefaultStatus(t *testing.T) {
	e := NewError(0, "oops", "msg")
	if e.Status != 500 {
		t.Errorf("expected status 500, got %d", e.Status)
	}
}

// ── shared helper ─────────────────────────────────────────────────────────────

func requireCode(t *testing.T, err *ServiceError, status int, code string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected ServiceError{%d,%q}, got nil", status, code)
	}
	if err.Status != status {
		t.Errorf("expected status %d, got %d", status, err.Status)
	}
	if err.Code != code {
		t.Errorf("expected code %q, got %q", code, err.Code)
	}
}
