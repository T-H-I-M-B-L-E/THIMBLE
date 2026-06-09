package repositories

import (
	"context"
	"fmt"
	"strings"
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
// email along with its expiry and how many guesses have been made against it.
// Used by both signup-verify and forgot-password.
func GetLatestVerificationCode(ctx context.Context, email string) (code string, expiresAt time.Time, attempts int, id int64, err error) {
	err = db.Pool.QueryRow(ctx,
		"SELECT id, code, expires_at, attempts FROM email_verification_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
		email).Scan(&id, &code, &expiresAt, &attempts)
	return
}

// IncrementVerificationAttempts bumps the attempts counter for a specific code
// row so we can lock it out after too many wrong guesses.
func IncrementVerificationAttempts(ctx context.Context, id int64) {
	db.Pool.Exec(ctx, "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1", id)
}

// InvalidateVerificationCode marks a code as unusable by setting expires_at to
// the past. Used after too many failed attempts so the user must request a new one.
func InvalidateVerificationCode(ctx context.Context, id int64) {
	db.Pool.Exec(ctx, "UPDATE email_verification_codes SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", id)
}

func GetPendingSignup(ctx context.Context, email string) (passwordHash, fullName string, err error) {
	err = db.Pool.QueryRow(ctx,
		"SELECT password_hash, full_name FROM pending_signups WHERE email = $1",
		email).Scan(&passwordHash, &fullName)
	return
}

func CreateUser(ctx context.Context, userId, email, passwordHash, fullName string) error {
	// Derive a username from the email local part, sanitised. If a row already
	// exists with the same lowercase username, append a short suffix and retry.
	base := usernameFromEmail(email)
	for attempt := 0; attempt < 5; attempt++ {
		candidate := base
		if attempt > 0 {
			candidate = fmt.Sprintf("%s%d", base, 100+attempt*17)
		}
		_, err := db.Pool.Exec(ctx,
			"INSERT INTO users (id, email, password_hash, full_name, role, username) VALUES ($1, $2, $3, $4, $5, $6)",
			userId, email, passwordHash, fullName, "", candidate)
		if err == nil {
			return nil
		}
		// 23505 = unique_violation. Retry with a new candidate.
		if !strings.Contains(err.Error(), "uq_users_username_lower") {
			return err
		}
	}
	return fmt.Errorf("could not generate a unique username after 5 attempts")
}

// usernameFromEmail returns a safe, lowercase username derived from the local
// part of an email. Strips anything that isn't [a-z0-9_], pads short results.
func usernameFromEmail(email string) string {
	local := email
	if at := strings.Index(email, "@"); at > 0 {
		local = email[:at]
	}
	local = strings.ToLower(local)
	var b strings.Builder
	for _, r := range local {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) < 3 {
		out = out + "user"
	}
	if len(out) > 24 {
		out = out[:24]
	}
	return out
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

// ── Login brute-force protection ────────────────────────────────────────────

const maxLoginFailures = 10
const loginLockDuration = 15 * time.Minute

// LoginLockStatus returns how many failures are recorded and whether the
// account is currently locked. Returns zero values if no row exists yet.
func LoginLockStatus(ctx context.Context, email string) (failedCount int, lockedUntil *time.Time, err error) {
	var lu *time.Time
	var fc int
	e := db.Pool.QueryRow(ctx,
		"SELECT failed_count, locked_until FROM login_attempts WHERE email = $1", email,
	).Scan(&fc, &lu)
	if e != nil {
		// no row = no failures yet
		return 0, nil, nil
	}
	return fc, lu, nil
}

// RecordLoginFailure increments the failed counter for an email.
// If the count reaches maxLoginFailures it sets locked_until.
func RecordLoginFailure(ctx context.Context, email string) {
	db.Pool.Exec(ctx, `
		INSERT INTO login_attempts (email, failed_count, last_attempt)
		VALUES ($1, 1, NOW())
		ON CONFLICT (email) DO UPDATE
		  SET failed_count  = login_attempts.failed_count + 1,
		      last_attempt  = NOW(),
		      locked_until  = CASE
		        WHEN login_attempts.failed_count + 1 >= $2
		        THEN NOW() + ($3 * INTERVAL '1 minute')
		        ELSE login_attempts.locked_until
		      END
	`, email, maxLoginFailures, int(loginLockDuration.Minutes()))
}

// ClearLoginFailures resets the counter after a successful login.
func ClearLoginFailures(ctx context.Context, email string) {
	db.Pool.Exec(ctx, "DELETE FROM login_attempts WHERE email = $1", email)
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
