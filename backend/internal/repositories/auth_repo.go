package repositories

import (
	"context"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

// EmailExists returns true if a user with email is already in the users table.
func EmailExists(ctx context.Context, email string) bool {
	var existingId string
	err := db.Pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", email).Scan(&existingId)
	return err == nil
}

// SavePendingSignup writes (or refreshes) the row in pending_signups. Users
// only land in the real users table after they verify the email code.
func SavePendingSignup(ctx context.Context, email, passwordHash, fullName string) error {
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO pending_signups (email, password_hash, full_name, created_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3, created_at = NOW()`,
		email, passwordHash, fullName)
	return err
}

func SaveVerificationCode(ctx context.Context, email, code string, expiresAt time.Time) error {
	_, err := db.Pool.Exec(ctx,
		"INSERT INTO email_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)",
		email, code, expiresAt)
	return err
}

// GetLatestVerificationCode returns the most recently issued code for
// email along with its expiry. Used by both signup-verify and forgot-password.
func GetLatestVerificationCode(ctx context.Context, email string) (string, time.Time, error) {
	var storedCode string
	var expiresAt time.Time
	err := db.Pool.QueryRow(ctx,
		"SELECT code, expires_at FROM email_verification_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
		email).Scan(&storedCode, &expiresAt)
	return storedCode, expiresAt, err
}

func GetPendingSignup(ctx context.Context, email string) (passwordHash, fullName string, err error) {
	err = db.Pool.QueryRow(ctx,
		"SELECT password_hash, full_name FROM pending_signups WHERE email = $1",
		email).Scan(&passwordHash, &fullName)
	return
}

func CreateUser(ctx context.Context, userId, email, passwordHash, fullName string) error {
	_, err := db.Pool.Exec(ctx,
		"INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)",
		userId, email, passwordHash, fullName, "")
	return err
}

func DeletePendingSignup(ctx context.Context, email string) {
	db.Pool.Exec(ctx, "DELETE FROM pending_signups WHERE email = $1", email)
}

// LoginRecord is what we read from users on a login attempt: enough to
// verify the password, hydrate the response, and decide if a ban applies.
type LoginRecord struct {
	User           models.User
	HashedPassword string
	IsAdmin        bool
	BannedUntil    *time.Time
}

func FindUserForLogin(ctx context.Context, email string) (*LoginRecord, error) {
	rec := &LoginRecord{}
	var avatarUrl, bio, location, website, verificationStatus *string
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, full_name, username, role, avatar_url, bio, location, website,
		        verification_status, is_verified, followers, following, posts, is_admin,
		        is_banned, banned_until, ban_message
		 FROM users WHERE email = $1`,
		email).Scan(&rec.User.ID, &rec.User.Email, &rec.HashedPassword, &rec.User.FullName, &rec.User.Username, &rec.User.Role,
		&avatarUrl, &bio, &location, &website, &verificationStatus, &rec.User.IsVerified,
		&rec.User.Followers, &rec.User.Following, &rec.User.Posts, &rec.IsAdmin,
		&rec.User.IsBanned, &rec.BannedUntil, &rec.User.BanMessage)
	if err != nil {
		return nil, err
	}
	if avatarUrl != nil {
		rec.User.AvatarUrl = *avatarUrl
	}
	if bio != nil {
		rec.User.Bio = *bio
	}
	if location != nil {
		rec.User.Location = *location
	}
	if website != nil {
		rec.User.Website = *website
	}
	if verificationStatus != nil {
		rec.User.VerificationStatus = *verificationStatus
	}
	if rec.BannedUntil != nil {
		s := rec.BannedUntil.UTC().Format(time.RFC3339)
		rec.User.BannedUntil = &s
		if rec.BannedUntil.Before(time.Now()) {
			rec.User.IsBanned = false
			rec.User.BannedUntil = nil
			rec.User.BanMessage = ""
		}
	}
	return rec, nil
}

// RecordLogin stamps last_login_at and bumps the total_logins counter.
func RecordLogin(ctx context.Context, userId string) {
	db.Pool.Exec(ctx,
		"UPDATE users SET last_login_at = NOW(), total_logins = total_logins + 1 WHERE id = $1", userId)
}

func UpdatePasswordByEmail(ctx context.Context, email, passwordHash string) (int64, error) {
	result, err := db.Pool.Exec(ctx,
		"UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2",
		passwordHash, email)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
