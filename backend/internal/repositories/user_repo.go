package repositories

import (
	"context"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

// FindUserByID returns the user record at id along with the cooldown
// timestamp (username_changed_at). bannedUntil is post-processed by the
// caller to expire ban state.
func FindUserByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	var avatarUrl, bio, location, website, instagram, verificationStatus *string
	var bannedUntil, usernameChangedAt *time.Time
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, full_name, username, username_changed_at, role, avatar_url, bio, location, website, instagram,
		        verification_status, is_verified,
		        followers, following, posts, is_banned, banned_until, ban_message
		 FROM users WHERE id = $1`, id).
		Scan(&user.ID, &user.Email, &user.FullName, &user.Username, &usernameChangedAt,
			&user.Role, &avatarUrl, &bio, &location, &website, &instagram,
			&verificationStatus, &user.IsVerified, &user.Followers, &user.Following, &user.Posts,
			&user.IsBanned, &bannedUntil, &user.BanMessage)
	if err != nil {
		return nil, err
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
	if instagram != nil {
		user.Instagram = *instagram
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
	if usernameChangedAt != nil {
		s := usernameChangedAt.UTC().Format(time.RFC3339)
		user.UsernameChangedAt = &s
	}
	return &user, nil
}

// GetUsernameAndChangedAt returns the current username and the timestamp
// of the last change (or nil). Used to enforce the 30-day cooldown.
func GetUsernameAndChangedAt(ctx context.Context, id string) (string, *time.Time, error) {
	var name string
	var changedAt *time.Time
	err := db.Pool.QueryRow(ctx,
		`SELECT username, username_changed_at FROM users WHERE id = $1`, id,
	).Scan(&name, &changedAt)
	return name, changedAt, err
}

// UpdateUsername writes the new username and stamps username_changed_at.
// The unique constraint on users.username surfaces as a pgconn.PgError
// with code 23505; callers translate that to "username_taken".
func UpdateUsername(ctx context.Context, id, newName string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET username = $1, username_changed_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		newName, id)
	return err
}

// UpdateProfileFields uses COALESCE so callers can pass nil for any
// field they want left untouched.
func UpdateProfileFields(ctx context.Context, id string, role, bio, avatar, website, location, fullName, instagram *string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET
			role = COALESCE($1, role),
			bio = COALESCE($2, bio),
			avatar_url = COALESCE($3, avatar_url),
			website = COALESCE($4, website),
			location = COALESCE($5, location),
			full_name = COALESCE($6, full_name),
			instagram = COALESCE($7, instagram),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $8`,
		role, bio, avatar, website, location, fullName, instagram, id)
	return err
}

type SuggestedUser struct {
	ID        string `json:"id"`
	FullName  string `json:"fullName"`
	AvatarUrl string `json:"avatarUrl"`
	Role      string `json:"role"`
	Location  string `json:"location"`
}

// SuggestUsers returns up to 5 users the caller is not yet following,
// ordered by popularity.
func SuggestUsers(ctx context.Context, userId string) ([]SuggestedUser, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, full_name, COALESCE(avatar_url,''), COALESCE(role,''), COALESCE(location,'')
		 FROM users
		 WHERE id != $1
		   AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = $1)
		   AND NOT EXISTS (
		     SELECT 1 FROM blocks b
		     WHERE (b.blocker_id = $1 AND b.blocked_id = users.id)
		        OR (b.blocker_id = users.id AND b.blocked_id = $1)
		   )
		 ORDER BY followers DESC
		 LIMIT 5`, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []SuggestedUser
	for rows.Next() {
		var u SuggestedUser
		rows.Scan(&u.ID, &u.FullName, &u.AvatarUrl, &u.Role, &u.Location)
		users = append(users, u)
	}
	if users == nil {
		users = []SuggestedUser{}
	}
	return users, nil
}

type UserSummary struct {
	ID                 string `json:"id"`
	FullName           string `json:"fullName"`
	Username           string `json:"username"`
	AvatarUrl          string `json:"avatarUrl"`
	Role               string `json:"role"`
	VerificationStatus string `json:"verificationStatus"`
	IsVerified         bool   `json:"isVerified"`
}

func ListAllUsers(ctx context.Context, callerID string) ([]UserSummary, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, full_name, username, COALESCE(avatar_url,''), COALESCE(role,''), verification_status, is_verified
		 FROM users
		 WHERE id != $1
		   AND NOT EXISTS (
		     SELECT 1 FROM blocks b
		     WHERE (b.blocker_id = $1 AND b.blocked_id = users.id)
		        OR (b.blocker_id = users.id AND b.blocked_id = $1)
		   )
		 ORDER BY full_name ASC LIMIT 200`, callerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []UserSummary
	for rows.Next() {
		var u UserSummary
		rows.Scan(&u.ID, &u.FullName, &u.Username, &u.AvatarUrl, &u.Role, &u.VerificationStatus, &u.IsVerified)
		users = append(users, u)
	}
	if users == nil {
		users = []UserSummary{}
	}
	return users, nil
}

func PromoteToAdmin(ctx context.Context, email string) (int64, error) {
	result, err := db.Pool.Exec(ctx, "UPDATE users SET is_admin = true WHERE email = $1", email)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
