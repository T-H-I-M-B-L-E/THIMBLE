package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func handleSignup(c *fiber.Ctx) error {
	var req SignupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Email == "" || req.Password == "" || req.FullName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email, password, and fullName are required"})
	}

	var existingId string
	err := dbPool.QueryRow(context.Background(), "SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingId)
	if err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "email already registered"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to process signup"})
	}

	_, err = dbPool.Exec(context.Background(),
		`INSERT INTO pending_signups (email, password_hash, full_name, created_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3, created_at = NOW()`,
		req.Email, string(hashedPassword), req.FullName)
	if err != nil {
		log.Printf("Failed to save pending signup: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to process signup"})
	}

	code := generateVerificationCode()
	expiresAt := time.Now().Add(10 * time.Minute)
	_, err = dbPool.Exec(context.Background(),
		"INSERT INTO email_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)",
		req.Email, code, expiresAt)
	if err != nil {
		log.Printf("Failed to save verification code: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to send verification email"})
	}

	if err := sendVerificationEmail(req.Email, code); err != nil {
		log.Printf("Failed to send email: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to send verification email"})
	}

	return c.Status(200).JSON(SignupResponse{
		VerificationRequired: true,
		ExpiresIn:            "10m",
		Message:              "Verification email sent. Please check your inbox.",
	})
}

func handleVerifyEmail(c *fiber.Ctx) error {
	var req VerifyEmailRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Email == "" || req.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email and code are required"})
	}

	var storedCode string
	var expiresAt time.Time
	err := dbPool.QueryRow(context.Background(),
		"SELECT code, expires_at FROM email_verification_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
		req.Email).Scan(&storedCode, &expiresAt)
	if err != nil || storedCode != req.Code || time.Now().After(expiresAt) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid or expired verification code"})
	}

	var hashedPassword, fullName string
	err = dbPool.QueryRow(context.Background(),
		"SELECT password_hash, full_name FROM pending_signups WHERE email = $1",
		req.Email).Scan(&hashedPassword, &fullName)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "signup session not found, please sign up again"})
	}

	userId := uuid.New().String()
	_, err = dbPool.Exec(context.Background(),
		"INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)",
		userId, req.Email, hashedPassword, fullName, "")
	if err != nil {
		log.Printf("Failed to create user: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to create user"})
	}

	dbPool.Exec(context.Background(), "DELETE FROM pending_signups WHERE email = $1", req.Email)

	token, err := generateJWT(userId, req.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate token"})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    token,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   os.Getenv("ENVIRONMENT") == "production",
		SameSite: "Lax",
	})

	user := User{ID: userId, Email: req.Email, FullName: fullName}
	return c.Status(200).JSON(AuthResponse{Token: token, User: user})
}

func handleLogin(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Email == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email and password are required"})
	}

	var user User
	var hashedPassword string
	var isAdmin bool
	var avatarUrl, bio, location, website, verificationStatus *string
	var bannedUntil *time.Time
	err := dbPool.QueryRow(context.Background(),
		`SELECT id, email, password_hash, full_name, role, avatar_url, bio, location, website,
		        verification_status, followers, following, posts, is_admin,
		        is_banned, banned_until, ban_message
		 FROM users WHERE email = $1`,
		req.Email).Scan(&user.ID, &user.Email, &hashedPassword, &user.FullName, &user.Role,
		&avatarUrl, &bio, &location, &website, &verificationStatus,
		&user.Followers, &user.Following, &user.Posts, &isAdmin,
		&user.IsBanned, &bannedUntil, &user.BanMessage)
	if err != nil {
		log.Printf("Login scan error for %s: %v", req.Email, err)
		return c.Status(401).JSON(fiber.Map{"error": "invalid email or password"})
	}

	if avatarUrl != nil {
		user.AvatarUrl = *avatarUrl
	}
	if bio != nil {
		user.Bio = *bio
	}
	if location != nil {
		user.Location = *location
	}
	if website != nil {
		user.Website = *website
	}
	if verificationStatus != nil {
		user.VerificationStatus = *verificationStatus
	}
	if bannedUntil != nil {
		s := bannedUntil.UTC().Format(time.RFC3339)
		user.BannedUntil = &s
		if bannedUntil.Before(time.Now()) {
			user.IsBanned = false
			user.BannedUntil = nil
			user.BanMessage = ""
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "invalid email or password"})
	}

	if user.IsBanned {
		return c.Status(403).JSON(fiber.Map{
			"error":       "banned",
			"banMessage":  user.BanMessage,
			"bannedUntil": user.BannedUntil,
		})
	}

	dbPool.Exec(context.Background(),
		"UPDATE users SET last_login_at = NOW(), total_logins = total_logins + 1 WHERE id = $1", user.ID)

	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate token"})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    token,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   os.Getenv("ENVIRONMENT") == "production",
		SameSite: "Lax",
	})

	return c.Status(200).JSON(fiber.Map{
		"token":   token,
		"user":    user,
		"isAdmin": isAdmin,
	})
}

func handleLogout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		Secure:   os.Getenv("ENVIRONMENT") == "production",
		SameSite: "Lax",
	})
	return c.Status(200).JSON(fiber.Map{"success": true})
}

func handleForgotPassword(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	code := generateVerificationCode()
	expiresAt := time.Now().Add(10 * time.Minute)
	_, err := dbPool.Exec(context.Background(),
		"INSERT INTO email_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)",
		req.Email, code, expiresAt)
	if err != nil {
		log.Printf("Failed to save reset code: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to send reset email"})
	}

	if err := sendVerificationEmail(req.Email, code); err != nil {
		log.Printf("Failed to send email: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to send reset email"})
	}

	return c.Status(200).JSON(fiber.Map{"resetEmailSent": true})
}

func handleResetPassword(c *fiber.Ctx) error {
	var req struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	var storedCode string
	var expiresAt time.Time
	err := dbPool.QueryRow(context.Background(),
		"SELECT code, expires_at FROM email_verification_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
		req.Email).Scan(&storedCode, &expiresAt)
	if err != nil || storedCode != req.Code || time.Now().After(expiresAt) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid or expired reset code"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to reset password"})
	}

	result, err := dbPool.Exec(context.Background(),
		"UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2",
		string(hashedPassword), req.Email)
	if err != nil {
		log.Printf("Reset password DB error for %s: %v", req.Email, err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to reset password"})
	}
	if result.RowsAffected() == 0 {
		log.Printf("Reset password: no user found with email %s", req.Email)
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	return c.Status(200).JSON(fiber.Map{"success": true})
}
