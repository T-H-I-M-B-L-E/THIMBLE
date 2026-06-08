package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

func UpdateUserProfile(c *fiber.Ctx) error {
	id := c.Params("id")
	callerID := c.Locals("userId").(string)

	var body struct {
		Role      *string `json:"role"`
		Bio       *string `json:"bio"`
		Avatar    *string `json:"avatar"`
		Website   *string `json:"website"`
		Location  *string `json:"location"`
		Username  *string `json:"username"`
		FullName  *string `json:"fullName"`
		Instagram *string `json:"instagram"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	patch := services.UserProfilePatch{
		Role:      body.Role,
		Bio:       body.Bio,
		Avatar:    body.Avatar,
		Website:   body.Website,
		Location:  body.Location,
		Username:  body.Username,
		FullName:  body.FullName,
		Instagram: body.Instagram,
	}
	if err := services.UpdateUserProfile(c.Context(), callerID, id, patch); err != nil {
		// Username errors return code + message — preserve that shape.
		if err.Code == "invalid_username" || err.Code == "username_taken" || err.Code == "username_cooldown" {
			return c.Status(err.Status).JSON(fiber.Map{
				"error":   err.Code,
				"message": err.Message,
			})
		}
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func GetUserProfile(c *fiber.Ctx) error {
	id := c.Params("id")
	callerID, _ := c.Locals("userId").(string)
	u, err := services.GetUserProfile(c.Context(), callerID, id)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(u)
}

func UserSuggestions(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	users, err := services.SuggestUsers(c.Context(), userId)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(users)
}

func ListAllUsers(c *fiber.Ctx) error {
	callerID, _ := c.Locals("userId").(string)
	q := strings.TrimSpace(c.Query("q"))
	role := strings.TrimSpace(c.Query("role"))
	users, err := services.SearchUsers(c.Context(), callerID, q, role)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(users)
}
