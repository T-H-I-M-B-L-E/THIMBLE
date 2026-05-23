package handlers

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/config"
	"chat-app/internal/models"
	"chat-app/internal/services"
)

func Signup(c *fiber.Ctx) error {
	var req models.SignupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := services.Signup(c.Context(), req); err != nil {
		return respondError(c, err)
	}
	return c.Status(200).JSON(models.SignupResponse{
		VerificationRequired: true,
		ExpiresIn:            "10m",
		Message:              "Verification email sent. Please check your inbox.",
	})
}

func VerifyEmail(c *fiber.Ctx) error {
	var req models.VerifyEmailRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	result, err := services.VerifyEmail(c.Context(), req)
	if err != nil {
		return respondError(c, err)
	}
	setAuthCookie(c, result.Token)
	return c.Status(200).JSON(models.AuthResponse{Token: result.Token, User: result.User})
}

func Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	result, err := services.Login(c.Context(), req)
	if err != nil {
		// Ban responses carry extra metadata the frontend renders.
		if err.Code == "banned" && result != nil {
			return c.Status(403).JSON(fiber.Map{
				"error":       "banned",
				"banMessage":  result.User.BanMessage,
				"bannedUntil": result.User.BannedUntil,
			})
		}
		return respondError(c, err)
	}
	setAuthCookie(c, result.Token)
	return c.Status(200).JSON(fiber.Map{
		"token":   result.Token,
		"user":    result.User,
		"isAdmin": result.IsAdmin,
	})
}

func Logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		Secure:   config.IsProduction(),
		SameSite: "Lax",
	})
	return c.Status(200).JSON(fiber.Map{"success": true})
}

func ForgotPassword(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := services.ForgotPassword(c.Context(), req.Email); err != nil {
		return respondError(c, err)
	}
	return c.Status(200).JSON(fiber.Map{"resetEmailSent": true})
}

func ResetPassword(c *fiber.Ctx) error {
	var req struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := services.ResetPassword(c.Context(), req.Email, req.Code, req.NewPassword); err != nil {
		return respondError(c, err)
	}
	return c.Status(200).JSON(fiber.Map{"success": true})
}

// MakeAdmin is the bootstrap endpoint that grants admin to a user.
// It is gated by ADMIN_BOOTSTRAP_SECRET — when the env var is unset the
// route returns 404 to hide its existence.
func MakeAdmin(c *fiber.Ctx) error {
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
	if err := services.MakeAdmin(c.Context(), req.Email); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func setAuthCookie(c *fiber.Ctx, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    token,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   config.IsProduction(),
		SameSite: "Lax",
	})
}
