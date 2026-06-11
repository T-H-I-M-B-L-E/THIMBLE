package handlers

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

// AdminBroadcast sends the message via the requested channels (email and/or
// banner) and returns counts.
func AdminBroadcast(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	var input services.BroadcastInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	result, err := services.SendBroadcast(c.Context(), adminID, input)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// AdminBroadcastPreview returns the recipient count for an audience without
// sending. Query params: roles=designer,model & verified=true.
func AdminBroadcastPreview(c *fiber.Ctx) error {
	a := audienceFromQuery(c)
	n, err := services.CountAudience(c.Context(), a)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"recipients": n, "label": services.AudienceLabel(a)})
}

// AdminBroadcastHistory returns the most recent broadcasts (newest first).
func AdminBroadcastHistory(c *fiber.Ctx) error {
	list, err := services.RecentBroadcasts(c.Context(), 20)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch history"})
	}
	return c.JSON(list)
}

// AdminBroadcastFailures returns the failed recipients (and reasons) for a
// broadcast. ?id=N targets a specific broadcast; omitting it uses the most
// recent one, so ARIA can answer "which just failed and why".
func AdminBroadcastFailures(c *fiber.Ctx) error {
	var id int64
	if idStr := c.Query("id"); idStr != "" {
		if n, err := strconv.ParseInt(idStr, 10, 64); err == nil {
			id = n
		}
	}
	resolvedID, failures, err := services.BroadcastFailuresFor(c.Context(), id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch failures"})
	}
	if failures == nil {
		failures = []services.BroadcastFailure{}
	}
	return c.JSON(fiber.Map{"broadcastId": resolvedID, "failures": failures, "count": len(failures)})
}

// AdminBannerCurrent returns the currently-active banner (if any) for the
// admin dashboard.
func AdminBannerCurrent(c *fiber.Ctx) error {
	b, err := services.CurrentBanner(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if b == nil {
		return c.JSON(nil)
	}
	return c.JSON(b)
}

// AdminBannerTakeDown deactivates the current banner immediately.
func AdminBannerTakeDown(c *fiber.Ctx) error {
	if err := services.TakeDownBanner(c.Context()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// audienceFromQuery parses ?roles=designer,model&verified=true into Audience.
func audienceFromQuery(c *fiber.Ctx) services.Audience {
	a := services.Audience{}
	if rolesStr := c.Query("roles"); rolesStr != "" {
		for _, r := range strings.Split(rolesStr, ",") {
			r = strings.TrimSpace(r)
			if r != "" {
				a.Roles = append(a.Roles, r)
			}
		}
	}
	if c.Query("verified") == "true" {
		a.VerifiedOnly = true
	}
	return a
}
