package handlers

import (
	"os"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

// GithubWebhook is the receiver for GitHub push events. It validates
// the HMAC signature (if configured), parses the payload, then defers
// to the service. The webhook always returns 200 so GitHub doesn't
// retry — failures are intentionally swallowed inside the service.
func GithubWebhook(c *fiber.Ctx) error {
	secret := os.Getenv("GITHUB_WEBHOOK_SECRET")
	if !services.VerifyGithubSignature(secret, c.Get("X-Hub-Signature-256"), c.Body()) {
		if c.Get("X-Hub-Signature-256") == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing signature"})
		}
		return c.Status(401).JSON(fiber.Map{"error": "invalid signature"})
	}

	if c.Get("X-GitHub-Event") != "push" {
		return c.SendStatus(200)
	}

	var payload services.GithubPushEvent
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
	}

	services.ProcessGithubPush(c.Context(), payload)
	return c.SendStatus(200)
}
