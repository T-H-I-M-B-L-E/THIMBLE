package main

import (
	"context"
	"errors"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
)

// Usernames: 3–30 chars, lower-case letters/digits/underscore/dot. No leading
// or trailing punctuation, no doubled punctuation. Matches a reasonable
// real-world handle without being painful to type on mobile.
var usernameRe = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])?$`)

const usernameCooldownDays = 30

func handleMakeAdmin(c *fiber.Ctx) error {
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
}

func handleUpdateUserProfile(c *fiber.Ctx) error {
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
		Username *string `json:"username"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	ctx := context.Background()

	// Username gets its own validation + cooldown enforcement before the
	// generic UPDATE so we can return precise error codes.
	if body.Username != nil {
		newName := strings.ToLower(strings.TrimSpace(*body.Username))
		if !usernameRe.MatchString(newName) {
			return c.Status(400).JSON(fiber.Map{
				"error":     "invalid_username",
				"message":   "Usernames are 3–30 characters: lowercase letters, numbers, underscore, or dot. Must start and end with a letter or number.",
			})
		}

		var currentName string
		var changedAt *time.Time
		if err := dbPool.QueryRow(ctx,
			`SELECT username, username_changed_at FROM users WHERE id = $1`, id,
		).Scan(&currentName, &changedAt); err != nil {
			log.Printf("Failed to read username for %s: %v", id, err)
			return c.Status(500).JSON(fiber.Map{"error": "failed to update profile"})
		}

		// Treat no-op as success so the modal can submit other fields without
		// tripping the cooldown.
		if newName != currentName {
			if changedAt != nil {
				nextAllowed := changedAt.Add(usernameCooldownDays * 24 * time.Hour)
				if time.Now().Before(nextAllowed) {
					return c.Status(409).JSON(fiber.Map{
						"error":           "username_cooldown",
						"message":         "You can only change your username once every 30 days.",
						"nextAllowedAt":   nextAllowed.UTC().Format(time.RFC3339),
					})
				}
			}

			if _, err := dbPool.Exec(ctx,
				`UPDATE users SET username = $1, username_changed_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
				newName, id); err != nil {
				var pgErr *pgconn.PgError
				if errors.As(err, &pgErr) && pgErr.Code == "23505" {
					return c.Status(409).JSON(fiber.Map{
						"error":   "username_taken",
						"message": "That username is already taken.",
					})
				}
				log.Printf("Failed to update username for %s: %v", id, err)
				return c.Status(500).JSON(fiber.Map{"error": "failed to update profile"})
			}
		}
	}

	if body.Role != nil || body.Bio != nil || body.Avatar != nil || body.Website != nil || body.Location != nil {
		_, err := dbPool.Exec(ctx,
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
	}

	return c.JSON(fiber.Map{"success": true})
}


func handleGetUserProfile(c *fiber.Ctx) error {
	id := c.Params("id")
	var user User
	var avatarUrl, bio, location, website, verificationStatus *string
	var bannedUntil, usernameChangedAt *time.Time
	err := dbPool.QueryRow(context.Background(),
		`SELECT id, email, full_name, username, username_changed_at, role, avatar_url, bio, location, website,
		        verification_status, is_verified,
		        followers, following, posts, is_banned, banned_until, ban_message
		 FROM users WHERE id = $1`, id).
		Scan(&user.ID, &user.Email, &user.FullName, &user.Username, &usernameChangedAt,
			&user.Role, &avatarUrl, &bio, &location, &website,
			&verificationStatus, &user.IsVerified, &user.Followers, &user.Following, &user.Posts,
			&user.IsBanned, &bannedUntil, &user.BanMessage)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
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
	if usernameChangedAt != nil {
		s := usernameChangedAt.UTC().Format(time.RFC3339)
		user.UsernameChangedAt = &s
	}
	return c.JSON(user)
}

func handleUserSuggestions(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	type SuggestedUser struct {
		ID        string `json:"id"`
		FullName  string `json:"fullName"`
		AvatarUrl string `json:"avatarUrl"`
		Role      string `json:"role"`
		Location  string `json:"location"`
	}
	rows, err := dbPool.Query(context.Background(),
		`SELECT id, full_name, COALESCE(avatar_url,''), COALESCE(role,''), COALESCE(location,'')
		 FROM users
		 WHERE id != $1
		   AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = $1)
		 ORDER BY followers DESC
		 LIMIT 5`, userId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch suggestions"})
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
	return c.JSON(users)
}

func handleListAllUsers(c *fiber.Ctx) error {
	rows, err := dbPool.Query(context.Background(),
		`SELECT id, full_name, username, COALESCE(avatar_url,''), COALESCE(role,''), verification_status, is_verified
		 FROM users ORDER BY full_name ASC LIMIT 200`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch users"})
	}
	defer rows.Close()
	type UserSummary struct {
		ID                 string `json:"id"`
		FullName           string `json:"fullName"`
		Username           string `json:"username"`
		AvatarUrl          string `json:"avatarUrl"`
		Role               string `json:"role"`
		VerificationStatus string `json:"verificationStatus"`
		IsVerified         bool   `json:"isVerified"`
	}
	var users []UserSummary
	for rows.Next() {
		var u UserSummary
		rows.Scan(&u.ID, &u.FullName, &u.Username, &u.AvatarUrl, &u.Role, &u.VerificationStatus, &u.IsVerified)
		users = append(users, u)
	}
	if users == nil {
		users = []UserSummary{}
	}
	return c.JSON(users)
}
