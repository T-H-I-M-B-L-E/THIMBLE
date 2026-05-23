package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/resend/resend-go/v2"

	"chat-app/internal/config"
	"chat-app/internal/repositories"
)

// GithubPushEvent is the subset of the GitHub push webhook we read. Only
// the fields used in the commit-notification email are listed here.
type GithubPushEvent struct {
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

// VerifyGithubSignature performs the HMAC-SHA256 check GitHub describes
// for the X-Hub-Signature-256 header. Returns true if no secret is
// configured (which is the legacy/dev mode).
func VerifyGithubSignature(secret, signature string, body []byte) bool {
	if secret == "" {
		return true
	}
	if signature == "" {
		return false
	}
	expected := "sha256=" + hmacSha256([]byte(secret), body)
	return signature == expected
}

func hmacSha256(key, data []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return hex.EncodeToString(mac.Sum(nil))
}

// ProcessGithubPush sends the commit-summary email to all admins. It
// silently returns on every non-fatal condition — the webhook must
// respond 200 to GitHub regardless of whether we actually emailed.
func ProcessGithubPush(ctx context.Context, payload GithubPushEvent) {
	if payload.Ref != "refs/heads/main" && payload.Ref != "refs/heads/master" {
		return
	}
	if len(payload.Commits) == 0 {
		return
	}

	adminEmails, err := repositories.ListAdminEmails(ctx)
	if err != nil || len(adminEmails) == 0 {
		return
	}

	enabled := repositories.GetSetting(ctx, "commit_emails_enabled")
	if enabled != "true" {
		return
	}

	latest := payload.Commits[0]
	latestMsg := firstLine(latest.Message)
	html := renderCommitEmailHTML(payload)

	client := resend.NewClient(config.ResendKey())
	_, sendErr := client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      adminEmails,
		Subject: fmt.Sprintf("[THIMBLE] %s — %s", latestMsg, payload.Pusher.Name),
		Html:    html,
	})
	if sendErr == nil {
		repositories.LogEmailSend(ctx, "commit_notification", len(adminEmails))
	}
}

func firstLine(s string) string {
	if idx := strings.Index(s, "\n"); idx != -1 {
		return s[:idx]
	}
	return s
}

func renderCommitEmailHTML(payload GithubPushEvent) string {
	commitItems := ""
	for i, commit := range payload.Commits {
		msg := firstLine(commit.Message)
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

	return fmt.Sprintf(`<!DOCTYPE html>
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
}
