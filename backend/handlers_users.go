package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

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
}

func handleGetUserProfile(c *fiber.Ctx) error {
	id := c.Params("id")
	var user User
	var avatarUrl, bio, location, website, verificationStatus *string
	var bannedUntil *time.Time
	err := dbPool.QueryRow(context.Background(),
		`SELECT id, email, full_name, role, avatar_url, bio, location, website, verification_status,
		        followers, following, posts, is_banned, banned_until, ban_message
		 FROM users WHERE id = $1`, id).
		Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &avatarUrl, &bio, &location, &website,
			&verificationStatus, &user.Followers, &user.Following, &user.Posts,
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
	return c.JSON(user)
}

func handleListAllUsers(c *fiber.Ctx) error {
	rows, err := dbPool.Query(context.Background(),
		`SELECT id, full_name, COALESCE(avatar_url,''), COALESCE(role,''), verification_status
		 FROM users ORDER BY full_name ASC LIMIT 200`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch users"})
	}
	defer rows.Close()
	type UserSummary struct {
		ID                 string `json:"id"`
		FullName           string `json:"fullName"`
		AvatarUrl          string `json:"avatarUrl"`
		Role               string `json:"role"`
		VerificationStatus string `json:"verificationStatus"`
	}
	var users []UserSummary
	for rows.Next() {
		var u UserSummary
		rows.Scan(&u.ID, &u.FullName, &u.AvatarUrl, &u.Role, &u.VerificationStatus)
		users = append(users, u)
	}
	if users == nil {
		users = []UserSummary{}
	}
	return c.JSON(users)
}
