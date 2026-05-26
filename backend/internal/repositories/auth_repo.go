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

// GetUserPasswordHash returns the bcrypt hash stored for a user.
func GetUserPasswordHash(ctx context.Context, userID string) (string, error) {
	var hash string
	err := db.Pool.QueryRow(ctx,
		"SELECT password_hash FROM users WHERE id = $1", userID).Scan(&hash)
	return hash, err
}

// UpdatePasswordByID swaps a user's password hash.
func UpdatePasswordByID(ctx context.Context, userID, passwordHash string) error {
	_, err := db.Pool.Exec(ctx,
		"UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
		passwordHash, userID)
	return err
}

// UpdateEmail swaps a user's email. Returns ErrEmailTaken if another row owns it.
func UpdateEmail(ctx context.Context, userID, newEmail string) error {
	_, err := db.Pool.Exec(ctx,
		"UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
		newEmail, userID)
	return err
}

// DeleteUserByID permanently removes a user row and all rows that
// reference it via ON DELETE CASCADE foreign keys.
func DeleteUserByID(ctx context.Context, userID string) error {
	_, err := db.Pool.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	return err
}

// GetEmailPrefs returns the user's notification preferences as raw JSON.
func GetEmailPrefs(ctx context.Context, userID string) ([]byte, error) {
	var prefs []byte
	err := db.Pool.QueryRow(ctx,
		"SELECT email_prefs FROM users WHERE id = $1", userID).Scan(&prefs)
	return prefs, err
}

// UpdateEmailPrefs writes a JSON object of notification preferences.
func UpdateEmailPrefs(ctx context.Context, userID string, prefs []byte) error {
	_, err := db.Pool.Exec(ctx,
		"UPDATE users SET email_prefs = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
		prefs, userID)
	return err
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

// GetTokenVersion returns the user's current token_version. JWTs carry
// this value as a claim; any mismatch invalidates the token.
func GetTokenVersion(ctx context.Context, userID string) (int, error) {
	var v int
	err := db.Pool.QueryRow(ctx,
		"SELECT token_version FROM users WHERE id = $1", userID).Scan(&v)
	return v, err
}

// BumpTokenVersion increments the user's token_version, invalidating
// every JWT issued before this call. The caller is responsible for
// issuing a fresh token if they want the current session to stay alive.
func BumpTokenVersion(ctx context.Context, userID string) error {
	_, err := db.Pool.Exec(ctx,
		"UPDATE users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
		userID)
	return err
}
