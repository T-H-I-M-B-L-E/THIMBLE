package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/repositories"
	"chat-app/internal/services"
)
// repositories is used for GigInput type in CreateGig

func ListGigs(c *fiber.Ctx) error {
	callerID, _ := c.Locals("userId").(string)
	gigs, serr := services.ListGigs(c.Context(), callerID)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(gigs)
}

func CreateGig(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var input repositories.GigInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if input.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "title is required"})
	}
	gig, serr := services.CreateGig(c.Context(), input, userID)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.Status(201).JSON(gig)
}

func CloseGig(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	gigID, err := strconv.Atoi(c.Params("id"))
	if err != nil || gigID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid gig id"})
	}
	if serr := services.CloseGig(c.Context(), gigID, userID); serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(fiber.Map{"ok": true})
}

func DeleteGig(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	gigID, err := strconv.Atoi(c.Params("id"))
	if err != nil || gigID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid gig id"})
	}
	if serr := services.DeleteGig(c.Context(), gigID, userID); serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(fiber.Map{"ok": true})
}

func GigApplicants(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	gigID, err := strconv.Atoi(c.Params("id"))
	if err != nil || gigID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid gig id"})
	}
	applicants, serr := services.ListApplicants(c.Context(), gigID, userID)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(applicants)
}

func UpdateApplicantStatus(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	gigID, err := strconv.Atoi(c.Params("id"))
	if err != nil || gigID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid gig id"})
	}
	var body struct {
		ApplicantUserID string `json:"applicantUserId"`
		Status          string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil || body.ApplicantUserID == "" || body.Status == "" {
		return c.Status(400).JSON(fiber.Map{"error": "applicantUserId and status required"})
	}
	if serr := services.UpdateApplicantStatus(c.Context(), gigID, body.ApplicantUserID, userID, body.Status); serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(fiber.Map{"ok": true})
}

func ApplyToGig(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	gigID, perr := strconv.Atoi(c.Params("id"))
	if perr != nil || gigID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid gig id"})
	}
	already, err := services.ApplyToGig(c.Context(), gigID, userID)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "already": already})
}
