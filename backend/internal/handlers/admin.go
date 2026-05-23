package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/repositories"
	"chat-app/internal/services"
)

func AdminStats(c *fiber.Ctx) error {
	stats, err := services.AdminStats(c.Context())
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(stats)
}

func AdminAuditLog(c *fiber.Ctx) error {
	return c.JSON(services.AdminAuditLog(c.Context()))
}

func AdminListUsers(c *fiber.Ctx) error {
	users, err := services.AdminListUsers(c.Context(),
		c.Query("search", ""), c.Query("role", ""), c.Query("admin", ""))
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(users)
}

func AdminGetUser(c *fiber.Ctx) error {
	u, err := services.AdminGetUser(c.Context(), c.Params("id"))
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(u)
}

func AdminUpdateUser(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)

	var raw struct {
		Role               *string `json:"role"`
		VerificationStatus *string `json:"verificationStatus"`
		IsVerified         *bool   `json:"isVerified"`
		IsAdmin            *bool   `json:"isAdmin"`
	}
	if err := c.BodyParser(&raw); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	patch := repositories.AdminUserPatch{
		Role:               raw.Role,
		VerificationStatus: raw.VerificationStatus,
		IsVerified:         raw.IsVerified,
		IsAdmin:            raw.IsAdmin,
	}
	if err := services.AdminUpdateUser(c.Context(), adminID, c.Params("id"), patch); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func AdminBanUser(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)

	var body struct {
		DurationHours int    `json:"durationHours"`
		Message       string `json:"message"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := services.AdminBanUser(c.Context(), adminID, c.Params("id"), body.DurationHours, body.Message); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func AdminUnbanUser(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	if err := services.AdminUnbanUser(c.Context(), adminID, c.Params("id")); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func AdminDeleteUser(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	if err := services.AdminDeleteUser(c.Context(), adminID, c.Params("id")); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(204)
}

func AdminGetSettings(c *fiber.Ctx) error {
	settings, err := services.AdminGetSettings(c.Context())
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(settings)
}

func AdminUpdateSettings(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)

	var body map[string]string
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	services.AdminUpdateSettings(c.Context(), adminID, body)
	return c.JSON(fiber.Map{"success": true})
}

func AdminEmailStats(c *fiber.Ctx) error {
	return c.JSON(services.AdminEmailStats(c.Context()))
}
