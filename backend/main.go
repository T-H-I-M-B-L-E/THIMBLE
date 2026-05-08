package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"
)

// User represents an authenticated user
type User struct {
	ID                 string `json:"id"`
	Email              string `json:"email"`
	FullName           string `json:"fullName"`
	Role               string `json:"role"`
	AvatarUrl          string `json:"avatarUrl,omitempty"`
	Bio                string `json:"bio,omitempty"`
	Location           string `json:"location,omitempty"`
	Website            string `json:"website,omitempty"`
	VerificationStatus string `json:"verificationStatus"`
	Followers          int    `json:"followers"`
	Following          int    `json:"following"`
	Posts              int    `json:"posts"`
}

type AdminUserView struct {
	ID                 string     `json:"id"`
	Email              string     `json:"email"`
	FullName           string     `json:"fullName"`
	Role               string     `json:"role"`
	VerificationStatus string     `json:"verificationStatus"`
	IsAdmin            bool       `json:"isAdmin"`
	CreatedAt          time.Time  `json:"createdAt"`
	LastLoginAt        *time.Time `json:"lastLoginAt"`
	TotalLogins        int        `json:"totalLogins"`
	Followers          int        `json:"followers"`
	Following          int        `json:"following"`
	Posts              int        `json:"posts"`
}

type AdminStats struct {
	TotalUsers           int `json:"totalUsers"`
	TodaySignups         int `json:"todaySignups"`
	WeekSignups          int `json:"weekSignups"`
	PendingVerifications int `json:"pendingVerifications"`
	VerifiedUsers        int `json:"verifiedUsers"`
	TotalLogins          int `json:"totalLogins"`
	AdminCount           int `json:"adminCount"`
}

type Message struct {
	UserId    string `json:"userId"`
	Name      string `json:"name"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

type TypingEvent struct {
	Type           string `json:"type"`
	ConversationId int    `json:"conversationId"`
	UserId         string `json:"userId"`
	Name           string `json:"name"`
	IsTyping       bool   `json:"isTyping"`
}

type Post struct {
	Id           int       `json:"id"`
	UserId       string    `json:"userId"`
	AuthorName   string    `json:"authorName"`
	AuthorAvatar string    `json:"authorAvatar"`
	ImageUrl     string    `json:"imageUrl"`
	Description  string    `json:"description"`
	Likes        int       `json:"likes"`
	TaggedUsers  []string  `json:"taggedUsers"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Gig struct {
	Id             int       `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Location       string    `json:"location"`
	Payment        string    `json:"payment"`
	PostedBy       string    `json:"postedBy"`
	PostedByRole   string    `json:"postedByRole"`
	PostedByAvatar string    `json:"postedByAvatar"`
	Applications   int       `json:"applications"`
	CreatedAt      time.Time `json:"createdAt"`
}

// Auth request/response types
type SignupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"fullName"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type VerifyEmailRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type SignupResponse struct {
	VerificationRequired bool   `json:"verificationRequired"`
	ExpiresIn            string `json:"expiresIn"`
	Message              string `json:"message"`
}

// JWT Claims
type Claims struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

var (
	clients   = make(map[*websocket.Conn]string)
	clientsMu sync.RWMutex
	dbPool    *pgxpool.Pool
	jwtSecret string
	resendKey string
)

// generateVerificationCode generates a 6-digit code
func generateVerificationCode() string {
	code, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", code.Int64())
}

// sendVerificationEmail sends an email via Resend
func sendVerificationEmail(email, code string) error {
	client := resend.NewClient(resendKey)

	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      []string{email},
		Subject: fmt.Sprintf("%s is your THIMBLE verification code", code),
		Html:    fmt.Sprintf(`<p>Your verification code is: <strong>%s</strong></p><p>This code expires in 10 minutes.</p>`, code),
	})

	return err
}

// generateJWT generates a JWT token
func generateJWT(userID, email string) (string, error) {
	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)), // 7 days
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "thimble",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// validateJWT validates and parses a JWT token
func validateJWT(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, err
	}

	return claims, nil
}

// jwtAuth middleware validates JWT from Authorization header or cookies
func jwtAuth(c *fiber.Ctx) error {
	// Try to get token from Authorization header
	authHeader := c.Get("Authorization")
	var tokenString string

	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	} else if token := c.Cookies("auth_token"); token != "" {
		// Fall back to cookie
		tokenString = token
	} else {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	claims, err := validateJWT(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	c.Locals("userId", claims.UserID)
	c.Locals("email", claims.Email)
	return c.Next()
}

// adminAuth middleware - must run AFTER jwtAuth. Checks is_admin flag in DB.
func adminAuth(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var isAdmin bool
	err := dbPool.QueryRow(context.Background(),
		"SELECT is_admin FROM users WHERE id = $1", userId).Scan(&isAdmin)
	if err != nil || !isAdmin {
		return c.Status(403).JSON(fiber.Map{"error": "forbidden: admin access required"})
	}

	return c.Next()
}

// Auth Handlers

// POST /auth/signup
func handleSignup(c *fiber.Ctx) error {
	var req SignupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Email == "" || req.Password == "" || req.FullName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email, password, and fullName are required"})
	}

	// Check if user already exists
	var existingId string
	err := dbPool.QueryRow(context.Background(), "SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingId)
	if err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "email already registered"})
	}

	// Hash password upfront so we can store it pending verification
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to process signup"})
	}

	// Store pending signup so verify-email doesn't need the password resent
	_, err = dbPool.Exec(context.Background(),
		`INSERT INTO pending_signups (email, password_hash, full_name, created_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3, created_at = NOW()`,
		req.Email, string(hashedPassword), req.FullName)
	if err != nil {
		log.Printf("Failed to save pending signup: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to process signup"})
	}

	// Generate verification code
	code := generateVerificationCode()
	expiresAt := time.Now().Add(10 * time.Minute)

	_, err = dbPool.Exec(context.Background(),
		"INSERT INTO email_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)",
		req.Email, code, expiresAt)
	if err != nil {
		log.Printf("Failed to save verification code: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to send verification email"})
	}

	// Send verification email via Resend
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

// POST /auth/verify-email
func handleVerifyEmail(c *fiber.Ctx) error {
	var req VerifyEmailRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Email == "" || req.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email and code are required"})
	}

	// Verify code
	var storedCode string
	var expiresAt time.Time
	err := dbPool.QueryRow(context.Background(),
		"SELECT code, expires_at FROM email_verification_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
		req.Email).Scan(&storedCode, &expiresAt)

	if err != nil || storedCode != req.Code || time.Now().After(expiresAt) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid or expired verification code"})
	}

	// Fetch pending signup data
	var hashedPassword, fullName string
	err = dbPool.QueryRow(context.Background(),
		"SELECT password_hash, full_name FROM pending_signups WHERE email = $1",
		req.Email).Scan(&hashedPassword, &fullName)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "signup session not found, please sign up again"})
	}

	// Create user
	userId := uuid.New().String()
	_, err = dbPool.Exec(context.Background(),
		"INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)",
		userId, req.Email, hashedPassword, fullName, "")
	if err != nil {
		log.Printf("Failed to create user: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to create user"})
	}

	// Clean up pending signup
	dbPool.Exec(context.Background(), "DELETE FROM pending_signups WHERE email = $1", req.Email)

	// Generate JWT
	token, err := generateJWT(userId, req.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate token"})
	}

	// Set httpOnly cookie
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    token,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   os.Getenv("ENVIRONMENT") == "production",
		SameSite: "Lax",
	})

	user := User{
		ID:       userId,
		Email:    req.Email,
		FullName: fullName,
		Role:     "model",
	}

	return c.Status(200).JSON(AuthResponse{
		Token: token,
		User:  user,
	})
}

// POST /auth/login
func handleLogin(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Email == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email and password are required"})
	}

	// Get user
	var user User
	var hashedPassword string
	var isAdmin bool
	var avatarUrl, bio, location, website, verificationStatus *string
	err := dbPool.QueryRow(context.Background(),
		"SELECT id, email, password_hash, full_name, role, avatar_url, bio, location, website, verification_status, followers, following, posts, is_admin FROM users WHERE email = $1",
		req.Email).Scan(&user.ID, &user.Email, &hashedPassword, &user.FullName, &user.Role, &avatarUrl, &bio, &location, &website, &verificationStatus, &user.Followers, &user.Following, &user.Posts, &isAdmin)

	if err != nil {
		log.Printf("Login scan error for %s: %v", req.Email, err)
		return c.Status(401).JSON(fiber.Map{"error": "invalid email or password"})
	}
	if avatarUrl != nil { user.AvatarUrl = *avatarUrl }
	if bio != nil { user.Bio = *bio }
	if location != nil { user.Location = *location }
	if website != nil { user.Website = *website }
	if verificationStatus != nil { user.VerificationStatus = *verificationStatus }

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "invalid email or password"})
	}

	// Record login timestamp and increment counter
	dbPool.Exec(context.Background(),
		"UPDATE users SET last_login_at = NOW(), total_logins = total_logins + 1 WHERE id = $1", user.ID)

	// Generate JWT
	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate token"})
	}

	// Set httpOnly cookie
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

// POST /auth/logout
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

// POST /auth/forgot-password
func handleForgotPassword(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Generate reset code
	code := generateVerificationCode()
	expiresAt := time.Now().Add(10 * time.Minute)

	_, err := dbPool.Exec(context.Background(),
		"INSERT INTO email_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)",
		req.Email, code, expiresAt)
	if err != nil {
		log.Printf("Failed to save reset code: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to send reset email"})
	}

	// Send reset email
	if err := sendVerificationEmail(req.Email, code); err != nil {
		log.Printf("Failed to send email: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to send reset email"})
	}

	return c.Status(200).JSON(fiber.Map{"resetEmailSent": true})
}

// POST /auth/reset-password
func handleResetPassword(c *fiber.Ctx) error {
	var req struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Verify code
	var storedCode string
	var expiresAt time.Time
	err := dbPool.QueryRow(context.Background(),
		"SELECT code, expires_at FROM email_verification_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
		req.Email).Scan(&storedCode, &expiresAt)

	if err != nil || storedCode != req.Code || time.Now().After(expiresAt) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid or expired reset code"})
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to reset password"})
	}

	// Update password
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

// WebSocket with JWT auth
func wsAuth(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	claims, err := validateJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	c.Locals("userId", claims.UserID)
	return c.Next()
}

func handleAdminStats(c *fiber.Ctx) error {
	ctx := context.Background()
	var stats AdminStats
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE").Scan(&stats.TodaySignups)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&stats.WeekSignups)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE verification_status = 'pending'").Scan(&stats.PendingVerifications)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE verification_status = 'verified'").Scan(&stats.VerifiedUsers)
	dbPool.QueryRow(ctx, "SELECT COALESCE(SUM(total_logins), 0) FROM users").Scan(&stats.TotalLogins)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE is_admin = true").Scan(&stats.AdminCount)
	return c.JSON(stats)
}

func handleAdminListUsers(c *fiber.Ctx) error {
	ctx := context.Background()
	search := c.Query("search", "")
	role := c.Query("role", "")
	adminOnly := c.Query("admin", "")

	query := `SELECT id, email, full_name, role, verification_status, is_admin, created_at, last_login_at, total_logins, followers, following, posts FROM users WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(" AND (email ILIKE $%d OR full_name ILIKE $%d)", argIdx, argIdx+1)
		args = append(args, "%"+search+"%", "%"+search+"%")
		argIdx += 2
	}

	if role != "" {
		query += fmt.Sprintf(" AND role = $%d", argIdx)
		args = append(args, role)
		argIdx++
	}

	if adminOnly == "true" {
		query += " AND is_admin = true"
	}

	query += " ORDER BY created_at DESC"

	rows, err := dbPool.Query(ctx, query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch users"})
	}
	defer rows.Close()

	var users []AdminUserView
	for rows.Next() {
		var u AdminUserView
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsAdmin, &u.CreatedAt, &u.LastLoginAt, &u.TotalLogins, &u.Followers, &u.Following, &u.Posts); err == nil {
			users = append(users, u)
		}
	}
	if users == nil {
		users = []AdminUserView{}
	}
	return c.JSON(users)
}

func handleAdminGetUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	var u AdminUserView
	err := dbPool.QueryRow(ctx,
		`SELECT id, email, full_name, role, verification_status, is_admin, created_at, last_login_at, total_logins, followers, following, posts FROM users WHERE id = $1`, id).Scan(
		&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsAdmin, &u.CreatedAt, &u.LastLoginAt, &u.TotalLogins, &u.Followers, &u.Following, &u.Posts)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}
	return c.JSON(u)
}

func handleAdminUpdateUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	var body struct {
		Role               *string `json:"role"`
		VerificationStatus *string `json:"verificationStatus"`
		IsAdmin            *bool   `json:"isAdmin"`
	}

	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.Role != nil {
		setClauses = append(setClauses, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, *body.Role)
		argIdx++
	}
	if body.VerificationStatus != nil {
		setClauses = append(setClauses, fmt.Sprintf("verification_status = $%d", argIdx))
		args = append(args, *body.VerificationStatus)
		argIdx++
	}
	if body.IsAdmin != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_admin = $%d", argIdx))
		args = append(args, *body.IsAdmin)
		argIdx++
	}

	if len(setClauses) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "no fields to update"})
	}

	setClauses = append(setClauses, "updated_at = CURRENT_TIMESTAMP")
	query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", strings.Join(setClauses, ", "), argIdx)
	args = append(args, id)

	result, err := dbPool.Exec(ctx, query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update user"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminDeleteUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	result, err := dbPool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete user"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}
	return c.SendStatus(204)
}

func handleGithubWebhook(c *fiber.Ctx) error {
	secret := os.Getenv("GITHUB_WEBHOOK_SECRET")

	// Verify signature if secret is configured
	if secret != "" {
		sig := c.Get("X-Hub-Signature-256")
		if sig == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing signature"})
		}
		expected := "sha256=" + hmacSha256([]byte(secret), c.Body())
		if sig != expected {
			return c.Status(401).JSON(fiber.Map{"error": "invalid signature"})
		}
	}

	event := c.Get("X-GitHub-Event")
	if event != "push" {
		return c.SendStatus(200)
	}

	var payload struct {
		Ref    string `json:"ref"`
		Pusher struct {
			Name string `json:"name"`
		} `json:"pusher"`
		Commits []struct {
			ID      string `json:"id"`
			Message string `json:"message"`
			URL     string `json:"url"`
			Author  struct {
				Name string `json:"name"`
			} `json:"author"`
			Timestamp string `json:"timestamp"`
		} `json:"commits"`
		Repository struct {
			FullName string `json:"full_name"`
			HTMLURL  string `json:"html_url"`
		} `json:"repository"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
	}

	// Only notify on pushes to main/master
	if payload.Ref != "refs/heads/main" && payload.Ref != "refs/heads/master" {
		return c.SendStatus(200)
	}
	if len(payload.Commits) == 0 {
		return c.SendStatus(200)
	}

	// Fetch all admin emails
	rows, err := dbPool.Query(context.Background(), "SELECT email FROM users WHERE is_admin = true")
	if err != nil {
		return c.SendStatus(200)
	}
	defer rows.Close()
	var adminEmails []string
	for rows.Next() {
		var email string
		if rows.Scan(&email) == nil {
			adminEmails = append(adminEmails, email)
		}
	}
	if len(adminEmails) == 0 {
		return c.SendStatus(200)
	}

	latest := payload.Commits[0]
	latestMsg := latest.Message
	if idx := strings.Index(latestMsg, "\n"); idx != -1 {
		latestMsg = latestMsg[:idx]
	}

	// Build commit items
	commitItems := ""
	for i, commit := range payload.Commits {
		msg := commit.Message
		if idx := strings.Index(msg, "\n"); idx != -1 {
			msg = msg[:idx]
		}
		if len(msg) > 72 {
			msg = msg[:72] + "…"
		}
		borderBottom := "border-bottom:1px solid #1f1f1f;"
		if i == len(payload.Commits)-1 {
			borderBottom = ""
		}
		commitItems += fmt.Sprintf(`
		<a href="%s" style="display:block;text-decoration:none;padding:14px 0;%s">
			<table style="width:100%%;border-collapse:collapse"><tr>
				<td style="width:52px;vertical-align:top;padding-top:1px">
					<span style="font-family:'Courier New',monospace;font-size:11px;color:#404040;background:#1a1a1a;padding:2px 6px;border-radius:4px;white-space:nowrap">%s</span>
				</td>
				<td style="padding-left:12px;vertical-align:top">
					<p style="margin:0 0 3px;font-size:13px;color:#e5e5e5;line-height:1.4">%s</p>
					<p style="margin:0;font-size:11px;color:#525252">%s</p>
				</td>
			</tr></table>
		</a>`, commit.URL, borderBottom, commit.ID[:7], msg, commit.Author.Name)
	}

	pluralS := ""
	if len(payload.Commits) > 1 {
		pluralS = "s"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#000000;min-height:100vh">
<tr><td align="center" style="padding:48px 20px">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px">

  <!-- Header -->
  <tr><td style="padding-bottom:40px">
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;color:#333333">THIMBLE</p>
    <p style="margin:0;font-size:28px;font-weight:200;letter-spacing:0.05em;color:#ffffff;line-height:1.2">Code Update</p>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding-bottom:32px">
    <div style="height:1px;background:linear-gradient(to right,#ffffff18,#ffffff04)"></div>
  </td></tr>

  <!-- Meta -->
  <tr><td style="padding-bottom:24px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:24px">
        <p style="margin:0 0 2px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#404040">Pushed by</p>
        <p style="margin:0;font-size:14px;color:#ffffff">%s</p>
      </td>
      <td style="padding-right:24px">
        <p style="margin:0 0 2px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#404040">Branch</p>
        <p style="margin:0;font-size:14px;color:#ffffff;font-family:'Courier New',monospace">main</p>
      </td>
      <td>
        <p style="margin:0 0 2px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#404040">Commits</p>
        <p style="margin:0;font-size:14px;color:#ffffff">%d commit%s</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- Commits -->
  <tr><td style="padding-bottom:32px">
    <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:4px 20px">
      %s
    </div>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding-bottom:40px;text-align:center">
    <a href="https://admin.tvimble.tech" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;padding:14px 40px;border-radius:100px;font-size:13px;font-weight:500;letter-spacing:0.02em">Open Admin Panel</a>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding-bottom:24px">
    <div style="height:1px;background:linear-gradient(to right,#ffffff04,#ffffff18,#ffffff04)"></div>
  </td></tr>

  <!-- Footer -->
  <tr><td>
    <p style="margin:0;font-size:11px;color:#2a2a2a;text-align:center;letter-spacing:0.05em">THIMBLE · Admin notification · <a href="https://tvimble.tech" style="color:#2a2a2a;text-decoration:none">tvimble.tech</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
		payload.Pusher.Name,
		len(payload.Commits),
		pluralS,
		commitItems,
	)

	// Send to all admins
	client := resend.NewClient(resendKey)
	client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      adminEmails,
		Subject: fmt.Sprintf("[THIMBLE] %s — %s", latestMsg, payload.Pusher.Name),
		Html:    html,
	})

	return c.SendStatus(200)
}

// hmacSha256 computes HMAC-SHA256 hex digest
func hmacSha256(key, data []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return hex.EncodeToString(mac.Sum(nil))
}

func main() {
	jwtSecret = os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	resendKey = os.Getenv("RESEND_API_KEY")
	if resendKey == "" {
		log.Fatal("RESEND_API_KEY environment variable is required")
	}

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgresql://localhost:5432/thimble_chat"
	}

	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:3000,https://tvimble.tech,https://admin.tvimble.com,https://admin.tvimble.tech"
	}

	var err error
	dbPool, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	defer dbPool.Close()

	// Ensure pending_signups table exists
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS pending_signups (
			email        TEXT PRIMARY KEY,
			password_hash TEXT NOT NULL,
			full_name    TEXT NOT NULL,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create pending_signups table:", err)
	}

	// Add last_login_at and total_logins columns if they don't exist
	dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`)
	dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS total_logins INT NOT NULL DEFAULT 0`)

	// Ensure messages table exists
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS messages (
			id        BIGSERIAL PRIMARY KEY,
			user_id   TEXT NOT NULL,
			name      TEXT NOT NULL,
			content   TEXT NOT NULL,
			timestamp BIGINT NOT NULL
		)
	`)
	if err != nil {
		log.Fatal("Failed to create messages table:", err)
	}

	// Ensure posts table exists
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS posts (
			id           BIGSERIAL PRIMARY KEY,
			user_id      TEXT NOT NULL,
			author_name  TEXT NOT NULL,
			author_avatar TEXT NOT NULL DEFAULT '',
			image_url    TEXT NOT NULL DEFAULT '',
			description  TEXT NOT NULL DEFAULT '',
			likes        INT NOT NULL DEFAULT 0,
			tagged_users JSONB NOT NULL DEFAULT '[]',
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create posts table:", err)
	}

	// Ensure gigs table exists
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS gigs (
			id               BIGSERIAL PRIMARY KEY,
			title            TEXT NOT NULL,
			description      TEXT NOT NULL DEFAULT '',
			location         TEXT NOT NULL DEFAULT '',
			payment          TEXT NOT NULL DEFAULT '',
			posted_by        TEXT NOT NULL,
			posted_by_role   TEXT NOT NULL DEFAULT '',
			posted_by_avatar TEXT NOT NULL DEFAULT '',
			applications     INT NOT NULL DEFAULT 0,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create gigs table:", err)
	}

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins: allowedOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
	}))

	// Auth endpoints (public)
	app.Post("/auth/signup", handleSignup)
	app.Post("/auth/verify-email", handleVerifyEmail)
	app.Post("/auth/login", handleLogin)
	app.Post("/auth/logout", handleLogout)
	app.Post("/auth/forgot-password", handleForgotPassword)
	app.Post("/auth/reset-password", handleResetPassword)

	// One-time bootstrap: make a user admin (secured by ADMIN_BOOTSTRAP_SECRET env var)
	app.Post("/auth/make-admin", func(c *fiber.Ctx) error {
		secret := os.Getenv("ADMIN_BOOTSTRAP_SECRET")
		if secret == "" {
			return c.Status(404).JSON(fiber.Map{"error": "not found"})
		}
		var req struct {
			Email  string `json:"email"`
			Secret string `json:"secret"`
		}
		if err := c.BodyParser(&req); err != nil || req.Secret != secret {
			return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
		}
		result, err := dbPool.Exec(context.Background(),
			"UPDATE users SET is_admin = true WHERE email = $1", req.Email)
		if err != nil || result.RowsAffected() == 0 {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
		return c.JSON(fiber.Map{"success": true})
	})

	// Update user profile (used by onboarding and profile edit)
	app.Patch("/users/:id", jwtAuth, func(c *fiber.Ctx) error {
		id := c.Params("id")
		callerID := c.Locals("userId").(string)
		if callerID != id {
			return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
		}
		var body struct {
			Role     *string `json:"role"`
			Bio      *string `json:"bio"`
			Avatar   *string `json:"avatar"`
			Website  *string `json:"website"`
			Location *string `json:"location"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
		}
		_, err := dbPool.Exec(context.Background(),
			`UPDATE users SET
				role = COALESCE($1, role),
				bio = COALESCE($2, bio),
				avatar_url = COALESCE($3, avatar_url),
				website = COALESCE($4, website),
				location = COALESCE($5, location),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = $6`,
			body.Role, body.Bio, body.Avatar, body.Website, body.Location, id)
		if err != nil {
			log.Printf("Failed to update user %s: %v", id, err)
			return c.Status(500).JSON(fiber.Map{"error": "failed to update profile"})
		}
		return c.JSON(fiber.Map{"success": true})
	})

	// Protected user profile endpoint used by /api/auth/me
	app.Get("/users/:id", jwtAuth, func(c *fiber.Ctx) error {
		id := c.Params("id")
		var user User
		var avatarUrl, bio, location, website, verificationStatus *string
		err := dbPool.QueryRow(context.Background(),
			"SELECT id, email, full_name, role, avatar_url, bio, location, website, verification_status, followers, following, posts FROM users WHERE id = $1",
			id).Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &avatarUrl, &bio, &location, &website, &verificationStatus, &user.Followers, &user.Following, &user.Posts)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
		if avatarUrl != nil { user.AvatarUrl = *avatarUrl }
		if bio != nil { user.Bio = *bio }
		if location != nil { user.Location = *location }
		if website != nil { user.Website = *website }
		if verificationStatus != nil { user.VerificationStatus = *verificationStatus }
		return c.JSON(user)
	})

	// WebSocket (protected)
	app.Get("/ws", wsAuth, websocket.New(func(c *websocket.Conn) {
		userId, _ := c.Locals("userId").(string)

		clientsMu.Lock()
		clients[c] = userId
		clientsMu.Unlock()

		log.Printf("Client connected: %s", userId)

		// Send last 50 messages as history
		rows, err := dbPool.Query(context.Background(),
			"SELECT user_id, name, content, timestamp FROM messages ORDER BY id DESC LIMIT 50")
		if err == nil {
			var history []Message
			for rows.Next() {
				var msg Message
				if err := rows.Scan(&msg.UserId, &msg.Name, &msg.Content, &msg.Timestamp); err == nil {
					history = append([]Message{msg}, history...)
				}
			}
			rows.Close()
			for _, msg := range history {
				msgBytes, _ := json.Marshal(msg)
				c.WriteMessage(websocket.TextMessage, msgBytes)
			}
		}

		defer func() {
			clientsMu.Lock()
			delete(clients, c)
			clientsMu.Unlock()
			c.Close()
		}()

		for {
			mt, msgBytes, err := c.ReadMessage()
			if err != nil {
				break
			}

			var eventMap map[string]interface{}
			if err := json.Unmarshal(msgBytes, &eventMap); err != nil {
				continue
			}

			if eventType, ok := eventMap["type"].(string); ok && eventType == "typing" {
				for client := range clients {
					client.WriteMessage(mt, msgBytes)
				}
				continue
			}

			var msg Message
			if err := json.Unmarshal(msgBytes, &msg); err != nil {
				continue
			}

			msg.UserId = userId

			_, err = dbPool.Exec(context.Background(),
				"INSERT INTO messages (user_id, name, content, timestamp) VALUES ($1, $2, $3, $4)",
				msg.UserId, msg.Name, msg.Content, msg.Timestamp)
			if err != nil {
				log.Printf("Failed to save message: %v", err)
			}

			out, _ := json.Marshal(msg)

			clientsMu.RLock()
			for client := range clients {
				client.WriteMessage(mt, out)
			}
			clientsMu.RUnlock()
		}
	}))

	// Posts API
	app.Get("/api/posts", func(c *fiber.Ctx) error {
		rows, err := dbPool.Query(context.Background(),
			"SELECT id, user_id, author_name, author_avatar, image_url, description, likes, tagged_users, created_at FROM posts ORDER BY created_at DESC LIMIT 20")
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to fetch posts"})
		}
		defer rows.Close()

		var posts []Post
		for rows.Next() {
			var p Post
			var taggedJSON []byte
			if err := rows.Scan(&p.Id, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.ImageUrl, &p.Description, &p.Likes, &taggedJSON, &p.CreatedAt); err == nil {
				json.Unmarshal(taggedJSON, &p.TaggedUsers)
				posts = append(posts, p)
			}
		}
		if posts == nil {
			posts = []Post{}
		}
		return c.JSON(posts)
	})

	app.Post("/api/posts", jwtAuth, func(c *fiber.Ctx) error {
		userId, _ := c.Locals("userId").(string)

		var p Post
		if err := c.BodyParser(&p); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
		}

		if strings.TrimSpace(p.ImageUrl) == "" {
			return c.Status(400).JSON(fiber.Map{"error": "imageUrl is required"})
		}

		p.UserId = userId
		if p.TaggedUsers == nil {
			p.TaggedUsers = []string{}
		}

		taggedJSON, _ := json.Marshal(p.TaggedUsers)

		err := dbPool.QueryRow(context.Background(),
			"INSERT INTO posts (user_id, author_name, author_avatar, image_url, description, tagged_users) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at",
			p.UserId, p.AuthorName, p.AuthorAvatar, p.ImageUrl, p.Description, taggedJSON).Scan(&p.Id, &p.CreatedAt)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to create post"})
		}

		return c.Status(201).JSON(p)
	})

	app.Delete("/api/posts/:id", jwtAuth, func(c *fiber.Ctx) error {
		userId, _ := c.Locals("userId").(string)
		postId := c.Params("id")

		result, err := dbPool.Exec(context.Background(),
			"DELETE FROM posts WHERE id = $1 AND user_id = $2", postId, userId)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to delete post"})
		}
		if result.RowsAffected() == 0 {
			return c.Status(404).JSON(fiber.Map{"error": "post not found"})
		}

		return c.SendStatus(204)
	})

	// Gigs API
	app.Get("/api/gigs", func(c *fiber.Ctx) error {
		rows, err := dbPool.Query(context.Background(),
			"SELECT id, title, description, location, payment, posted_by, posted_by_role, posted_by_avatar, applications, created_at FROM gigs ORDER BY created_at DESC")
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to fetch gigs"})
		}
		defer rows.Close()

		var gigs []Gig
		for rows.Next() {
			var g Gig
			if err := rows.Scan(&g.Id, &g.Title, &g.Description, &g.Location, &g.Payment, &g.PostedBy, &g.PostedByRole, &g.PostedByAvatar, &g.Applications, &g.CreatedAt); err == nil {
				gigs = append(gigs, g)
			}
		}
		if gigs == nil {
			gigs = []Gig{}
		}
		return c.JSON(gigs)
	})

	// GitHub webhook — receives push events and emails all admins
	app.Post("/webhooks/github", handleGithubWebhook)

	// Admin routes (JWT + is_admin required)
	adminGroup := app.Group("/admin", jwtAuth, adminAuth)
	adminGroup.Get("/stats", handleAdminStats)
	adminGroup.Get("/users", handleAdminListUsers)
	adminGroup.Get("/users/:id", handleAdminGetUser)
	adminGroup.Patch("/users/:id", handleAdminUpdateUser)
	adminGroup.Delete("/users/:id", handleAdminDeleteUser)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
