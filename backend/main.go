package main

import (
	"context"
	"crypto/rand"
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
	ID                 string    `json:"id"`
	Email              string    `json:"email"`
	FullName           string    `json:"fullName"`
	Role               string    `json:"role"`
	VerificationStatus string    `json:"verificationStatus"`
	IsAdmin            bool      `json:"isAdmin"`
	CreatedAt          time.Time `json:"createdAt"`
	Followers          int       `json:"followers"`
	Following          int       `json:"following"`
	Posts              int       `json:"posts"`
}

type AdminStats struct {
	TotalUsers           int `json:"totalUsers"`
	TodaySignups         int `json:"todaySignups"`
	WeekSignups          int `json:"weekSignups"`
	PendingVerifications int `json:"pendingVerifications"`
	VerifiedUsers        int `json:"verifiedUsers"`
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
		userId, req.Email, hashedPassword, fullName, "model")
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
	var avatarUrl, bio, location, website, verificationStatus *string
	err := dbPool.QueryRow(context.Background(),
		"SELECT id, email, password_hash, full_name, role, avatar_url, bio, location, website, verification_status, followers, following, posts FROM users WHERE email = $1",
		req.Email).Scan(&user.ID, &user.Email, &hashedPassword, &user.FullName, &user.Role, &avatarUrl, &bio, &location, &website, &verificationStatus, &user.Followers, &user.Following, &user.Posts)

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

	return c.Status(200).JSON(AuthResponse{
		Token: token,
		User:  user,
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
	return c.JSON(stats)
}

func handleAdminListUsers(c *fiber.Ctx) error {
	ctx := context.Background()
	search := c.Query("search", "")
	role := c.Query("role", "")

	query := `SELECT id, email, full_name, role, verification_status, is_admin, created_at, followers, following, posts FROM users WHERE 1=1`
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

	query += " ORDER BY created_at DESC"

	rows, err := dbPool.Query(ctx, query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch users"})
	}
	defer rows.Close()

	var users []AdminUserView
	for rows.Next() {
		var u AdminUserView
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsAdmin, &u.CreatedAt, &u.Followers, &u.Following, &u.Posts); err == nil {
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
		`SELECT id, email, full_name, role, verification_status, is_admin, created_at, followers, following, posts FROM users WHERE id = $1`, id).Scan(
		&u.ID, &u.Email, &u.FullName, &u.Role, &u.VerificationStatus, &u.IsAdmin, &u.CreatedAt, &u.Followers, &u.Following, &u.Posts)
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
