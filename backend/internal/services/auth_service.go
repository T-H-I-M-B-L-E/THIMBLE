package services

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"chat-app/internal/email"
	"chat-app/internal/middleware"
	"chat-app/internal/models"
	"chat-app/internal/repositories"
	"chat-app/internal/utils"
)

// Signup creates a pending signup row and emails a verification code.
// The real users row is only created when VerifyEmail succeeds.
func Signup(ctx context.Context, req models.SignupRequest) *ServiceError {
	if req.Email == "" || req.Password == "" || req.FullName == "" {
		return NewError(400, "missing_fields", "email, password, and fullName are required")
	}

	if repositories.EmailExists(ctx, req.Email) {
		return NewError(400, "email_taken", "email already registered")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return NewError(500, "hash_failed", "failed to process signup")
	}

	if err := repositories.SavePendingSignup(ctx, req.Email, string(hashedPassword), req.FullName); err != nil {
		log.Printf("Failed to save pending signup: %v", err)
		return NewError(500, "save_failed", "failed to process signup")
	}

	code := utils.GenerateVerificationCode()
	if err := repositories.SaveVerificationCode(ctx, req.Email, code, time.Now().Add(10*time.Minute)); err != nil {
		log.Printf("Failed to save verification code: %v", err)
		return NewError(500, "code_save_failed", "failed to send verification email")
	}

	if err := email.SendVerification(req.Email, code); err != nil {
		log.Printf("Failed to send email: %v", err)
		return NewError(500, "email_send_failed", "failed to send verification email")
	}

	return nil
}

// VerifyEmailResult contains the values handlers need to build the
// success response (token cookie + user payload).
type VerifyEmailResult struct {
	Token string
	User  models.User
}

func VerifyEmail(ctx context.Context, req models.VerifyEmailRequest) (*VerifyEmailResult, *ServiceError) {
	if req.Email == "" || req.Code == "" {
		return nil, NewError(400, "missing_fields", "email and code are required")
	}

	storedCode, expiresAt, err := repositories.GetLatestVerificationCode(ctx, req.Email)
	if err != nil || storedCode != req.Code || time.Now().After(expiresAt) {
		return nil, NewError(400, "invalid_code", "invalid or expired verification code")
	}

	hashedPassword, fullName, err := repositories.GetPendingSignup(ctx, req.Email)
	if err != nil {
		return nil, NewError(400, "signup_expired", "signup session not found, please sign up again")
	}

	userId := uuid.New().String()
	if err := repositories.CreateUser(ctx, userId, req.Email, hashedPassword, fullName); err != nil {
		log.Printf("Failed to create user: %v", err)
		return nil, NewError(500, "create_user_failed", "failed to create user")
	}
	repositories.DeletePendingSignup(ctx, req.Email)

	token, err := middleware.GenerateJWT(userId, req.Email)
	if err != nil {
		return nil, NewError(500, "token_failed", "failed to generate token")
	}

	return &VerifyEmailResult{
		Token: token,
		User:  models.User{ID: userId, Email: req.Email, FullName: fullName},
	}, nil
}

// LoginResult carries the authenticated user plus the is_admin flag the
// handler embeds in its response.
type LoginResult struct {
	Token   string
	User    models.User
	IsAdmin bool
}

func Login(ctx context.Context, req models.LoginRequest) (*LoginResult, *ServiceError) {
	if req.Email == "" || req.Password == "" {
		return nil, NewError(400, "missing_fields", "email and password are required")
	}

	rec, err := repositories.FindUserForLogin(ctx, req.Email)
	if err != nil {
		log.Printf("Login scan error for %s: %v", req.Email, err)
		return nil, NewError(401, "invalid_credentials", "invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(rec.HashedPassword), []byte(req.Password)); err != nil {
		return nil, NewError(401, "invalid_credentials", "invalid email or password")
	}

	if rec.User.IsBanned {
		// Special-case: include ban metadata so the frontend can render
		// a tailored banned screen.
		return &LoginResult{User: rec.User}, NewError(403, "banned", "")
	}

	repositories.RecordLogin(ctx, rec.User.ID)

	token, err := middleware.GenerateJWT(rec.User.ID, rec.User.Email)
	if err != nil {
		return nil, NewError(500, "token_failed", "failed to generate token")
	}

	return &LoginResult{Token: token, User: rec.User, IsAdmin: rec.IsAdmin}, nil
}

func ForgotPassword(ctx context.Context, addr string) *ServiceError {
	code := utils.GenerateVerificationCode()
	if err := repositories.SaveVerificationCode(ctx, addr, code, time.Now().Add(10*time.Minute)); err != nil {
		log.Printf("Failed to save reset code: %v", err)
		return NewError(500, "code_save_failed", "failed to send reset email")
	}
	if err := email.SendVerification(addr, code); err != nil {
		log.Printf("Failed to send email: %v", err)
		return NewError(500, "email_send_failed", "failed to send reset email")
	}
	return nil
}

func ResetPassword(ctx context.Context, email, code, newPassword string) *ServiceError {
	storedCode, expiresAt, err := repositories.GetLatestVerificationCode(ctx, email)
	if err != nil || storedCode != code || time.Now().After(expiresAt) {
		return NewError(400, "invalid_code", "invalid or expired reset code")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return NewError(500, "hash_failed", "failed to reset password")
	}

	rows, err := repositories.UpdatePasswordByEmail(ctx, email, string(hashedPassword))
	if err != nil {
		log.Printf("Reset password DB error for %s: %v", email, err)
		return NewError(500, "db_failed", "failed to reset password")
	}
	if rows == 0 {
		return NewError(404, "user_not_found", "user not found")
	}
	return nil
}

// ChangePassword updates the password for an authenticated user after
// verifying their current password.
func ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) *ServiceError {
	if len(newPassword) < 8 {
		return NewError(400, "weak_password", "new password must be at least 8 characters")
	}
	hash, err := repositories.GetUserPasswordHash(ctx, userID)
	if err != nil {
		return NewError(404, "user_not_found", "user not found")
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(currentPassword)) != nil {
		return NewError(401, "invalid_password", "current password is incorrect")
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return NewError(500, "hash_failed", "failed to update password")
	}
	if err := repositories.UpdatePasswordByID(ctx, userID, string(newHash)); err != nil {
		return NewError(500, "db_failed", "failed to update password")
	}
	return nil
}

// ChangeEmail updates the email for an authenticated user after verifying
// their current password. Returns email_taken if the new address is in use.
func ChangeEmail(ctx context.Context, userID, currentPassword, newEmail string) *ServiceError {
	if newEmail == "" {
		return NewError(400, "invalid_email", "new email is required")
	}
	hash, err := repositories.GetUserPasswordHash(ctx, userID)
	if err != nil {
		return NewError(404, "user_not_found", "user not found")
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(currentPassword)) != nil {
		return NewError(401, "invalid_password", "password is incorrect")
	}
	if repositories.EmailExists(ctx, newEmail) {
		return NewError(409, "email_taken", "that email is already registered")
	}
	if err := repositories.UpdateEmail(ctx, userID, newEmail); err != nil {
		return NewError(500, "db_failed", "failed to update email")
	}
	return nil
}

// DeleteAccount removes a user's account after verifying their password.
// All related rows (posts, follows, comments, etc.) are removed via ON
// DELETE CASCADE foreign keys.
func DeleteAccount(ctx context.Context, userID, currentPassword string) *ServiceError {
	hash, err := repositories.GetUserPasswordHash(ctx, userID)
	if err != nil {
		return NewError(404, "user_not_found", "user not found")
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(currentPassword)) != nil {
		return NewError(401, "invalid_password", "password is incorrect")
	}
	if err := repositories.DeleteUserByID(ctx, userID); err != nil {
		return NewError(500, "db_failed", "failed to delete account")
	}
	return nil
}
