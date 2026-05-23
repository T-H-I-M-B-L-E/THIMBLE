package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

func GetMyVerification(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	r, err := services.GetMyVerification(c.Context(), userID)
	if err != nil {
		return respondError(c, err)
	}
	// pgx.ErrNoRows surfaces as (nil, nil). Render the "no request yet" payload.
	if r == nil {
		return c.JSON(fiber.Map{"request": nil})
	}
	return c.JSON(fiber.Map{"request": r})
}

func SubmitVerification(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	var body services.SubmitVerificationInput
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	id, err := services.SubmitVerification(c.Context(), userID, body)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"id": id, "status": "pending"})
}

func AdminListVerificationRequests(c *fiber.Ctx) error {
	out, err := services.AdminListVerificationRequests(c.Context(), c.Query("status"))
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(out)
}

func AdminReviewVerification(c *fiber.Ctx) error {
	id := c.Params("id")
	adminID, _ := c.Locals("userId").(string)

	var body struct {
		Action    string `json:"action"`
		AdminNote string `json:"adminNote"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	result, err := services.AdminReviewVerification(c.Context(), id, body.Action, body.AdminNote, adminID)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{
		"success":         true,
		"status":          result.Status,
		"deletedDocument": result.DeletedDocument,
	})
}
