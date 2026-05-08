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
	TotalUsers           int            `json:"totalUsers"`
	TodaySignups         int            `json:"todaySignups"`
	WeekSignups          int            `json:"weekSignups"`
	PendingVerifications int            `json:"pendingVerifications"`
	VerifiedUsers        int            `json:"verifiedUsers"`
	UnverifiedUsers      int            `json:"unverifiedUsers"`
	TotalLogins          int            `json:"totalLogins"`
	AdminCount           int            `json:"adminCount"`
	ReturnedUsers        int            `json:"returnedUsers"`
	NeverLoggedIn        int            `json:"neverLoggedIn"`
	TotalPosts           int            `json:"totalPosts"`
	PostsThisWeek        int            `json:"postsThisWeek"`
	TotalGigs            int            `json:"totalGigs"`
	RoleBreakdown        []RoleCount    `json:"roleBreakdown"`
	DailySignups         []DailyCount   `json:"dailySignups"`
}

type RoleCount struct {
	Role  string `json:"role"`
	Count int    `json:"count"`
}

type DailyCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type AuditLog struct {
	ID         int       `json:"id"`
	AdminID    string    `json:"adminId"`
	AdminName  string    `json:"adminName"`
	Action     string    `json:"action"`
	TargetID   string    `json:"targetId"`
	TargetName string    `json:"targetName"`
	Details    string    `json:"details"`
	CreatedAt  time.Time `json:"createdAt"`
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

// rooms maps conversationId → set of connections
var (
	clients   = make(map[*websocket.Conn]string)       // legacy global broadcast
	rooms     = make(map[int]map[*websocket.Conn]string) // conversationId → conn → userId
	clientsMu sync.RWMutex
	dbPool    *pgxpool.Pool
	jwtSecret string
	resendKey string
)

type ConversationParticipant struct {
	ID             int    `json:"id"`
	ConversationID int    `json:"conversationId"`
	UserID         string `json:"userId"`
	UserName       string `json:"userName"`
	UserAvatar     string `json:"userAvatar"`
	JoinedAt       string `json:"joinedAt"`
}

type Conversation struct {
	ID           int                       `json:"id"`
	Participants []ConversationParticipant `json:"participants"`
	LastMessage  *ConvMessage              `json:"lastMessage,omitempty"`
	UpdatedAt    string                    `json:"updatedAt"`
}

type ConvMessage struct {
	ID             int    `json:"id"`
	ConversationID int    `json:"conversationId"`
	UserID         string `json:"userId"`
	Name           string `json:"name"`
	Content        string `json:"content"`
	Timestamp      int64  `json:"timestamp"`
}

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
	if err == nil {
		dbPool.Exec(context.Background(), "INSERT INTO email_log (type, recipients) VALUES ('verification', 1)")
	}
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
		Role:     "",
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

// wsAdminAuth — like wsAuth but also checks is_admin in DB
func wsAdminAuth(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := validateJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	var isAdmin bool
	dbPool.QueryRow(context.Background(), "SELECT is_admin FROM users WHERE id = $1", claims.UserID).Scan(&isAdmin)
	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
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
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE verification_status = 'unverified'").Scan(&stats.UnverifiedUsers)
	dbPool.QueryRow(ctx, "SELECT COALESCE(SUM(total_logins), 0) FROM users").Scan(&stats.TotalLogins)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE is_admin = true").Scan(&stats.AdminCount)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE total_logins > 1").Scan(&stats.ReturnedUsers)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE last_login_at IS NULL").Scan(&stats.NeverLoggedIn)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM posts").Scan(&stats.TotalPosts)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&stats.PostsThisWeek)
	dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM gigs").Scan(&stats.TotalGigs)

	// Role breakdown
	rows, err := dbPool.Query(ctx, `
		SELECT COALESCE(NULLIF(role,''), 'unset'), COUNT(*)
		FROM users GROUP BY 1 ORDER BY 2 DESC`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rc RoleCount
			if rows.Scan(&rc.Role, &rc.Count) == nil {
				stats.RoleBreakdown = append(stats.RoleBreakdown, rc)
			}
		}
	}

	// Daily signups — last 7 days
	rows2, err := dbPool.Query(ctx, `
		SELECT TO_CHAR(d::date, 'Mon DD') AS label, COALESCE(COUNT(u.id), 0)
		FROM generate_series(NOW() - INTERVAL '6 days', NOW(), '1 day') AS d
		LEFT JOIN users u ON u.created_at::date = d::date
		GROUP BY d ORDER BY d`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var dc DailyCount
			if rows2.Scan(&dc.Date, &dc.Count) == nil {
				stats.DailySignups = append(stats.DailySignups, dc)
			}
		}
	}

	return c.JSON(stats)
}

func handleAdminAuditLog(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := dbPool.Query(ctx, `
		SELECT a.id, a.admin_id, u.full_name, a.action, a.target_id, a.target_name, a.details, a.created_at
		FROM admin_audit_log a
		LEFT JOIN users u ON u.id = a.admin_id
		ORDER BY a.created_at DESC LIMIT 50`)
	if err != nil {
		return c.JSON([]AuditLog{})
	}
	defer rows.Close()
	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		if rows.Scan(&l.ID, &l.AdminID, &l.AdminName, &l.Action, &l.TargetID, &l.TargetName, &l.Details, &l.CreatedAt) == nil {
			logs = append(logs, l)
		}
	}
	if logs == nil {
		logs = []AuditLog{}
	}
	return c.JSON(logs)
}

func writeAuditLog(ctx context.Context, adminID, action, targetID, targetName, details string) {
	dbPool.Exec(ctx,
		`INSERT INTO admin_audit_log (admin_id, action, target_id, target_name, details) VALUES ($1, $2, $3, $4, $5)`,
		adminID, action, targetID, targetName, details)
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

	adminID, _ := c.Locals("userId").(string)
	var targetName string
	dbPool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", id).Scan(&targetName)
	writeAuditLog(ctx, adminID, "update_user", id, targetName, fmt.Sprintf("%v", body))

	return c.JSON(fiber.Map{"success": true})
}

func handleAdminDeleteUser(c *fiber.Ctx) error {
	ctx := context.Background()
	id := c.Params("id")

	var targetName string
	dbPool.QueryRow(ctx, "SELECT full_name FROM users WHERE id = $1", id).Scan(&targetName)

	result, err := dbPool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete user"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	adminID, _ := c.Locals("userId").(string)
	writeAuditLog(ctx, adminID, "delete_user", id, targetName, "user deleted")

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

	// Check if commit emails are enabled
	var enabled string
	dbPool.QueryRow(context.Background(), "SELECT value FROM settings WHERE key = 'commit_emails_enabled'").Scan(&enabled)
	if enabled != "true" {
		return c.SendStatus(200)
	}

	// Send to all admins
	client := resend.NewClient(resendKey)
	_, sendErr := client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      adminEmails,
		Subject: fmt.Sprintf("[THIMBLE] %s — %s", latestMsg, payload.Pusher.Name),
		Html:    html,
	})
	if sendErr == nil {
		dbPool.Exec(context.Background(),
			"INSERT INTO email_log (type, recipients) VALUES ('commit_notification', $1)",
			len(adminEmails))
	}

	return c.SendStatus(200)
}

func handleAdminGetSettings(c *fiber.Ctx) error {
	rows, err := dbPool.Query(context.Background(), "SELECT key, value FROM settings")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch settings"})
	}
	defer rows.Close()
	result := map[string]string{}
	for rows.Next() {
		var k, v string
		if rows.Scan(&k, &v) == nil {
			result[k] = v
		}
	}
	return c.JSON(result)
}

func handleAdminUpdateSettings(c *fiber.Ctx) error {
	var body map[string]string
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	for k, v := range body {
		dbPool.Exec(context.Background(),
			"INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
			k, v)
	}
	adminID, _ := c.Locals("userId").(string)
	writeAuditLog(context.Background(), adminID, "update_settings", "", "", fmt.Sprintf("%v", body))
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminEmailStats(c *fiber.Ctx) error {
	ctx := context.Background()
	var thisMonth, lastMonth, total int
	dbPool.QueryRow(ctx, `
		SELECT COALESCE(SUM(recipients), 0) FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW())`).Scan(&thisMonth)
	dbPool.QueryRow(ctx, `
		SELECT COALESCE(SUM(recipients), 0) FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
		  AND sent_at < DATE_TRUNC('month', NOW())`).Scan(&lastMonth)
	dbPool.QueryRow(ctx, "SELECT COALESCE(SUM(recipients), 0) FROM email_log").Scan(&total)

	// Per-type breakdown this month
	rows, err := dbPool.Query(ctx, `
		SELECT type, COALESCE(SUM(recipients), 0)
		FROM email_log
		WHERE sent_at >= DATE_TRUNC('month', NOW())
		GROUP BY type ORDER BY 2 DESC`)
	breakdown := map[string]int{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			var n int
			if rows.Scan(&t, &n) == nil {
				breakdown[t] = n
			}
		}
	}

	const monthlyLimit = 3000
	return c.JSON(fiber.Map{
		"thisMonth":    thisMonth,
		"lastMonth":    lastMonth,
		"total":        total,
		"monthlyLimit": monthlyLimit,
		"remaining":    monthlyLimit - thisMonth,
		"breakdown":    breakdown,
	})
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

	// Ensure audit log table exists
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS admin_audit_log (
			id          BIGSERIAL PRIMARY KEY,
			admin_id    TEXT NOT NULL,
			action      TEXT NOT NULL,
			target_id   TEXT NOT NULL DEFAULT '',
			target_name TEXT NOT NULL DEFAULT '',
			details     TEXT NOT NULL DEFAULT '',
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create admin_audit_log table:", err)
	}

	// Ensure settings table exists
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	if err != nil {
		log.Fatal("Failed to create settings table:", err)
	}
	// Default: commit emails enabled
	dbPool.Exec(context.Background(), `
		INSERT INTO settings (key, value) VALUES ('commit_emails_enabled', 'true')
		ON CONFLICT (key) DO NOTHING
	`)

	// Ensure email_log table exists
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS email_log (
			id         BIGSERIAL PRIMARY KEY,
			type       TEXT NOT NULL,
			recipients INT NOT NULL DEFAULT 1,
			sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create email_log table:", err)
	}

	dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS conversations (
			id         BIGSERIAL PRIMARY KEY,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS conversation_participants (
			id              BIGSERIAL PRIMARY KEY,
			conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
			user_id         TEXT NOT NULL,
			user_name       TEXT NOT NULL DEFAULT '',
			user_avatar     TEXT NOT NULL DEFAULT '',
			joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(conversation_id, user_id)
		)
	`)
	dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS admin_chat_messages (
			id         BIGSERIAL PRIMARY KEY,
			user_id    TEXT NOT NULL,
			user_name  TEXT NOT NULL DEFAULT '',
			content    TEXT NOT NULL,
			timestamp  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)

	dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS conversation_messages (
			id              BIGSERIAL PRIMARY KEY,
			conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
			user_id         TEXT NOT NULL,
			name            TEXT NOT NULL DEFAULT '',
			content         TEXT NOT NULL,
			timestamp       BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)

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

	// WebSocket — conversation-scoped rooms
	app.Get("/ws", wsAuth, websocket.New(func(c *websocket.Conn) {
		userId, _ := c.Locals("userId").(string)
		convIdStr := c.Query("conversationId")
		var convId int
		fmt.Sscanf(convIdStr, "%d", &convId)

		clientsMu.Lock()
		if convId > 0 {
			if rooms[convId] == nil {
				rooms[convId] = make(map[*websocket.Conn]string)
			}
			rooms[convId][c] = userId
		} else {
			clients[c] = userId
		}
		clientsMu.Unlock()

		defer func() {
			clientsMu.Lock()
			if convId > 0 {
				delete(rooms[convId], c)
			} else {
				delete(clients, c)
			}
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

			// Typing indicator — broadcast to room only
			if eventType, ok := eventMap["type"].(string); ok && eventType == "typing" {
				clientsMu.RLock()
				for conn := range rooms[convId] {
					if conn != c {
						conn.WriteMessage(mt, msgBytes)
					}
				}
				clientsMu.RUnlock()
				continue
			}

			var msg ConvMessage
			if err := json.Unmarshal(msgBytes, &msg); err != nil {
				continue
			}
			msg.UserID = userId
			if msg.ConversationID == 0 {
				msg.ConversationID = convId
			}
			if msg.Timestamp == 0 {
				msg.Timestamp = time.Now().UnixMilli()
			}

			// Persist to DB
			var insertedID int
			dbPool.QueryRow(context.Background(),
				"INSERT INTO conversation_messages (conversation_id, user_id, name, content, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING id",
				msg.ConversationID, msg.UserID, msg.Name, msg.Content, msg.Timestamp).Scan(&insertedID)
			msg.ID = insertedID

			// Update conversation updated_at
			dbPool.Exec(context.Background(),
				"UPDATE conversations SET updated_at = NOW() WHERE id = $1", msg.ConversationID)

			out, _ := json.Marshal(msg)

			// Broadcast to everyone in the room
			clientsMu.RLock()
			for conn := range rooms[convId] {
				conn.WriteMessage(mt, out)
			}
			clientsMu.RUnlock()
		}
	}))

	// Conversations API
	app.Get("/api/conversations", jwtAuth, func(c *fiber.Ctx) error {
		userId := c.Query("userId")
		if userId == "" {
			userId, _ = c.Locals("userId").(string)
		}
		ctx := context.Background()
		rows, err := dbPool.Query(ctx, `
			SELECT c.id, c.updated_at
			FROM conversations c
			JOIN conversation_participants cp ON cp.conversation_id = c.id
			WHERE cp.user_id = $1
			ORDER BY c.updated_at DESC`, userId)
		if err != nil {
			return c.JSON([]Conversation{})
		}
		defer rows.Close()

		var convs []Conversation
		for rows.Next() {
			var conv Conversation
			var updatedAt time.Time
			rows.Scan(&conv.ID, &updatedAt)
			conv.UpdatedAt = updatedAt.Format(time.RFC3339)

			// Load participants
			pRows, _ := dbPool.Query(ctx,
				"SELECT id, conversation_id, user_id, user_name, user_avatar, joined_at FROM conversation_participants WHERE conversation_id = $1", conv.ID)
			if pRows != nil {
				for pRows.Next() {
					var p ConversationParticipant
					var joinedAt time.Time
					pRows.Scan(&p.ID, &p.ConversationID, &p.UserID, &p.UserName, &p.UserAvatar, &joinedAt)
					p.JoinedAt = joinedAt.Format(time.RFC3339)
					conv.Participants = append(conv.Participants, p)
				}
				pRows.Close()
			}
			if conv.Participants == nil {
				conv.Participants = []ConversationParticipant{}
			}

			// Load last message
			var lm ConvMessage
			err := dbPool.QueryRow(ctx,
				"SELECT id, conversation_id, user_id, name, content, timestamp FROM conversation_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1", conv.ID).
				Scan(&lm.ID, &lm.ConversationID, &lm.UserID, &lm.Name, &lm.Content, &lm.Timestamp)
			if err == nil {
				conv.LastMessage = &lm
			}

			convs = append(convs, conv)
		}
		if convs == nil {
			convs = []Conversation{}
		}
		return c.JSON(convs)
	})

	app.Post("/api/conversations", jwtAuth, func(c *fiber.Ctx) error {
		userId, _ := c.Locals("userId").(string)
		ctx := context.Background()

		var req struct {
			Participants []ConversationParticipant `json:"participants"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
		}

		// Create conversation
		var convId int
		err := dbPool.QueryRow(ctx, "INSERT INTO conversations DEFAULT VALUES RETURNING id").Scan(&convId)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to create conversation"})
		}

		// Add creator + provided participants
		seen := map[string]bool{userId: true}
		for _, p := range req.Participants {
			if seen[p.UserID] {
				continue
			}
			seen[p.UserID] = true
			dbPool.Exec(ctx,
				"INSERT INTO conversation_participants (conversation_id, user_id, user_name, user_avatar) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
				convId, p.UserID, p.UserName, p.UserAvatar)
		}

		return c.Status(201).JSON(fiber.Map{"id": convId})
	})

	app.Get("/api/conversations/:id/messages", jwtAuth, func(c *fiber.Ctx) error {
		convId := c.Params("id")
		ctx := context.Background()
		rows, err := dbPool.Query(ctx,
			"SELECT id, conversation_id, user_id, name, content, timestamp FROM conversation_messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT 100", convId)
		if err != nil {
			return c.JSON([]ConvMessage{})
		}
		defer rows.Close()
		var msgs []ConvMessage
		for rows.Next() {
			var m ConvMessage
			rows.Scan(&m.ID, &m.ConversationID, &m.UserID, &m.Name, &m.Content, &m.Timestamp)
			msgs = append(msgs, m)
		}
		if msgs == nil {
			msgs = []ConvMessage{}
		}
		return c.JSON(msgs)
	})

	// Admin chat — history
	app.Get("/admin/chat/history", jwtAuth, adminAuth, func(c *fiber.Ctx) error {
		rows, err := dbPool.Query(context.Background(),
			"SELECT id, user_id, user_name, content, timestamp FROM admin_chat_messages ORDER BY timestamp ASC LIMIT 100")
		if err != nil {
			return c.JSON([]fiber.Map{})
		}
		defer rows.Close()
		var msgs []fiber.Map
		for rows.Next() {
			var id int
			var userId, userName, content string
			var ts int64
			if rows.Scan(&id, &userId, &userName, &content, &ts) == nil {
				msgs = append(msgs, fiber.Map{"id": id, "userId": userId, "name": userName, "content": content, "timestamp": ts})
			}
		}
		if msgs == nil {
			msgs = []fiber.Map{}
		}
		return c.JSON(msgs)
	})

	// Admin WebSocket — private admin-only room
	adminRoom := make(map[*websocket.Conn]string) // conn → userId
	var adminRoomMu sync.RWMutex

	app.Get("/admin/ws", wsAdminAuth, websocket.New(func(c *websocket.Conn) {
		userId, _ := c.Locals("userId").(string)
		var userName string
		dbPool.QueryRow(context.Background(), "SELECT full_name FROM users WHERE id = $1", userId).Scan(&userName)

		adminRoomMu.Lock()
		adminRoom[c] = userId
		adminRoomMu.Unlock()

		defer func() {
			adminRoomMu.Lock()
			delete(adminRoom, c)
			adminRoomMu.Unlock()
			c.Close()
		}()

		for {
			_, msgBytes, err := c.ReadMessage()
			if err != nil {
				break
			}

			var raw map[string]interface{}
			if err := json.Unmarshal(msgBytes, &raw); err != nil {
				continue
			}

			content, _ := raw["content"].(string)
			if content == "" {
				continue
			}

			ts := time.Now().UnixMilli()
			var insertedID int
			dbPool.QueryRow(context.Background(),
				"INSERT INTO admin_chat_messages (user_id, user_name, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING id",
				userId, userName, content, ts).Scan(&insertedID)

			out, _ := json.Marshal(fiber.Map{
				"id": insertedID, "userId": userId, "name": userName, "content": content, "timestamp": ts,
			})

			adminRoomMu.RLock()
			for conn := range adminRoom {
				conn.WriteMessage(websocket.TextMessage, out)
			}
			adminRoomMu.RUnlock()
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
	adminGroup.Get("/audit-log", handleAdminAuditLog)
	adminGroup.Get("/settings", handleAdminGetSettings)
	adminGroup.Patch("/settings", handleAdminUpdateSettings)
	adminGroup.Get("/email-stats", handleAdminEmailStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
