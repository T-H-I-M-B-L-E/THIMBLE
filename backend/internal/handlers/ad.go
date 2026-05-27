package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

func CreateAd(c *fiber.Ctx) error {
	callerID := optionalCallerID(c)
	var in services.AdInput
	if err := c.BodyParser(&in); err != nil {
		return respondError(c, services.NewError(400, "bad_body", "invalid request body"))
	}
	ad, serr := services.CreateAd(c.Context(), callerID, in)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.Status(201).JSON(ad)
}

func ListAds(c *fiber.Ctx) error {
	ads, serr := services.ListAds(c.Context())
	if serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(ads)
}

func GetAd(c *fiber.Ctx) error {
	id := c.Params("id")
	ad, serr := services.GetAd(c.Context(), id)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(ad)
}

func UpdateAd(c *fiber.Ctx) error {
	id := c.Params("id")
	var in services.AdInput
	if err := c.BodyParser(&in); err != nil {
		return respondError(c, services.NewError(400, "bad_body", "invalid request body"))
	}
	ad, serr := services.UpdateAd(c.Context(), id, in)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(ad)
}

func DeleteAd(c *fiber.Ctx) error {
	id := c.Params("id")
	serr := services.DeleteAd(c.Context(), id)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.SendStatus(204)
}

func ToggleAd(c *fiber.Ctx) error {
	id := c.Params("id")
	ad, serr := services.ToggleAd(c.Context(), id)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(ad)
}

func RecordAdClick(c *fiber.Ctx) error {
	id := c.Params("id")
	ad, serr := services.RecordAdClick(c.Context(), id)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.JSON(fiber.Map{"redirectUrl": ad.RedirectUrl})
}

func RecordAdImpression(c *fiber.Ctx) error {
	adID := c.Params("id")
	userID := optionalCallerID(c)
	serr := services.RecordAdImpression(c.Context(), adID, userID)
	if serr != nil {
		return respondError(c, serr)
	}
	return c.SendStatus(204)
}
