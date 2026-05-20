package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/resend/resend-go/v2"
)

func hmacSha256(key, data []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return hex.EncodeToString(mac.Sum(nil))
}

func handleGithubWebhook(c *fiber.Ctx) error {
	secret := os.Getenv("GITHUB_WEBHOOK_SECRET")

	if secret != "" {
		sig := c.Get("X-Hub-Signature-256")
		if sig == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing signature"})
		}
		expected := "sha256=" + hmacSha256([]byte(secret), c.Body())
		if sig != expected {
			return c.Status(401).JSON(fiber.Map{"error": "invalid signature"})
		}
	}

	event := c.Get("X-GitHub-Event")
	if event != "push" {
		return c.SendStatus(200)
	}

	var payload struct {
		Ref    string `json:"ref"`
		Pusher struct {
			Name string `json:"name"`
		} `json:"pusher"`
		Commits []struct {
			ID      string `json:"id"`
			Message string `json:"message"`
			URL     string `json:"url"`
			Author  struct {
				Name string `json:"name"`
			} `json:"author"`
			Timestamp string `json:"timestamp"`
		} `json:"commits"`
		Repository struct {
			FullName string `json:"full_name"`
			HTMLURL  string `json:"html_url"`
		} `json:"repository"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
	}

	if payload.Ref != "refs/heads/main" && payload.Ref != "refs/heads/master" {
		return c.SendStatus(200)
	}
	if len(payload.Commits) == 0 {
		return c.SendStatus(200)
	}

	rows, err := dbPool.Query(context.Background(), "SELECT email FROM users WHERE is_admin = true")
	if err != nil {
		return c.SendStatus(200)
	}
	defer rows.Close()
	var adminEmails []string
	for rows.Next() {
		var email string
		if rows.Scan(&email) == nil {
			adminEmails = append(adminEmails, email)
		}
	}
	if len(adminEmails) == 0 {
		return c.SendStatus(200)
	}

	latest := payload.Commits[0]
	latestMsg := latest.Message
	if idx := strings.Index(latestMsg, "\n"); idx != -1 {
		latestMsg = latestMsg[:idx]
	}

	commitItems := ""
	for i, commit := range payload.Commits {
		msg := commit.Message
		if idx := strings.Index(msg, "\n"); idx != -1 {
			msg = msg[:idx]
		}
		if len(msg) > 72 {
			msg = msg[:72] + "…"
		}
		borderBottom := "border-bottom:1px solid #1f1f1f;"
		if i == len(payload.Commits)-1 {
			borderBottom = ""
		}
		commitItems += fmt.Sprintf(`
		<a href="%s" style="display:block;text-decoration:none;padding:14px 0;%s">
			<table style="width:100%%;border-collapse:collapse"><tr>
				<td style="width:52px;vertical-align:top;padding-top:1px">
					<span style="font-family:'Courier New',monospace;font-size:11px;color:#404040;background:#1a1a1a;padding:2px 6px;border-radius:4px;white-space:nowrap">%s</span>
				</td>
				<td style="padding-left:12px;vertical-align:top">
					<p style="margin:0 0 3px;font-size:13px;color:#e5e5e5;line-height:1.4">%s</p>
					<p style="margin:0;font-size:11px;color:#525252">%s</p>
				</td>
			</tr></table>
		</a>`, commit.URL, borderBottom, commit.ID[:7], msg, commit.Author.Name)
	}

	pluralS := ""
	if len(payload.Commits) > 1 {
		pluralS = "s"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#000000;min-height:100vh">
<tr><td align="center" style="padding:48px 20px">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding-bottom:40px">
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;color:#333333">THIMBLE</p>
    <p style="margin:0;font-size:28px;font-weight:200;letter-spacing:0.05em;color:#ffffff;line-height:1.2">Code Update</p>
  </td></tr>
  <tr><td style="padding-bottom:32px"><div style="height:1px;background:linear-gradient(to right,#ffffff18,#ffffff04)"></div></td></tr>
  <tr><td style="padding-bottom:24px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:24px">
        <p style="margin:0 0 2px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#404040">Pushed by</p>
        <p style="margin:0;font-size:14px;color:#ffffff">%s</p>
      </td>
      <td style="padding-right:24px">
        <p style="margin:0 0 2px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#404040">Branch</p>
        <p style="margin:0;font-size:14px;color:#ffffff;font-family:'Courier New',monospace">main</p>
      </td>
      <td>
        <p style="margin:0 0 2px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#404040">Commits</p>
        <p style="margin:0;font-size:14px;color:#ffffff">%d commit%s</p>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-bottom:32px">
    <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:4px 20px">%s</div>
  </td></tr>
  <tr><td style="padding-bottom:40px;text-align:center">
    <a href="https://admin.tvimble.tech" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;padding:14px 40px;border-radius:100px;font-size:13px;font-weight:500">Open Admin Panel</a>
  </td></tr>
  <tr><td style="padding-bottom:24px"><div style="height:1px;background:linear-gradient(to right,#ffffff04,#ffffff18,#ffffff04)"></div></td></tr>
  <tr><td>
    <p style="margin:0;font-size:11px;color:#2a2a2a;text-align:center">THIMBLE · Admin notification · <a href="https://tvimble.tech" style="color:#2a2a2a;text-decoration:none">tvimble.tech</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
		payload.Pusher.Name, len(payload.Commits), pluralS, commitItems)

	var enabled string
	dbPool.QueryRow(context.Background(), "SELECT value FROM settings WHERE key = 'commit_emails_enabled'").Scan(&enabled)
	if enabled != "true" {
		return c.SendStatus(200)
	}

	client := resend.NewClient(resendKey)
	_, sendErr := client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      adminEmails,
		Subject: fmt.Sprintf("[THIMBLE] %s — %s", latestMsg, payload.Pusher.Name),
		Html:    html,
	})
	if sendErr == nil {
		dbPool.Exec(context.Background(),
			"INSERT INTO email_log (type, recipients) VALUES ('commit_notification', $1)",
			len(adminEmails))
	}

	return c.SendStatus(200)
}
