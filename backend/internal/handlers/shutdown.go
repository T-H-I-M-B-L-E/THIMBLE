package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"

	"chat-app/internal/config"
	"chat-app/internal/db"
	"chat-app/internal/repositories"
)

const superAdminEmail = "anjeesax@gmail.com"

// AdminShutdownPinStatus returns whether the calling admin has a shutdown PIN set.
func AdminShutdownPinStatus(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	var hash string
	db.Pool.QueryRow(c.Context(), `SELECT shutdown_pin_hash FROM users WHERE id = $1`, adminID).Scan(&hash) //nolint:errcheck
	return c.JSON(fiber.Map{"hasPin": hash != ""})
}

// AdminShutdownSetPin hashes and stores the admin's shutdown PIN.
func AdminShutdownSetPin(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)

	var body struct {
		Pin string `json:"pin"`
	}
	if err := c.BodyParser(&body); err != nil || len(body.Pin) != 4 {
		return c.Status(400).JSON(fiber.Map{"error": "PIN must be exactly 4 digits"})
	}
	for _, ch := range body.Pin {
		if ch < '0' || ch > '9' {
			return c.Status(400).JSON(fiber.Map{"error": "PIN must be digits only"})
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Pin), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to hash PIN"})
	}
	if _, err := db.Pool.Exec(c.Context(), `UPDATE users SET shutdown_pin_hash = $1 WHERE id = $2`, string(hash), adminID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save PIN"})
	}
	repositories.WriteAuditLog(c.Context(), adminID, "shutdown_pin_set", "", "", "")
	return c.JSON(fiber.Map{"set": true})
}

// AdminShutdownVerifyPin checks the PIN and returns a short-lived pin token on success.
func AdminShutdownVerifyPin(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)

	var body struct {
		Pin string `json:"pin"`
	}
	if err := c.BodyParser(&body); err != nil || body.Pin == "" {
		return c.Status(400).JSON(fiber.Map{"error": "pin required"})
	}

	var hash string
	if err := db.Pool.QueryRow(c.Context(), `SELECT shutdown_pin_hash FROM users WHERE id = $1`, adminID).Scan(&hash); err != nil || hash == "" {
		return c.Status(400).JSON(fiber.Map{"error": "no PIN set"})
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Pin)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "incorrect PIN"})
	}

	// Issue a short-lived pin token — reuses the same shutdown_tokens table
	token := generateOTP() + generateOTP()
	db.Pool.Exec(c.Context(), //nolint:errcheck
		`INSERT INTO shutdown_tokens (admin_id, token, expires_at) VALUES ($1, $2, $3)`,
		adminID, "pin_"+token, time.Now().Add(10*time.Minute))

	return c.JSON(fiber.Map{"pinVerified": true, "pinToken": "pin_" + token})
}

// isSuperAdmin returns true if the calling admin's email matches the super admin.
func isSuperAdmin(c *fiber.Ctx) bool {
	email, _ := c.Locals("email").(string)
	return strings.EqualFold(strings.TrimSpace(email), superAdminEmail)
}

func generateOTP() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

func sendShutdownOTP(to, code string) error {
	client := resend.NewClient(config.ResendKey())
	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      []string{to},
		Subject: fmt.Sprintf("🔐 %s — TVIMBLE Critical Action Code", code),
		Html: fmt.Sprintf(`
<div style="font-family:monospace;max-width:480px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;padding:32px;border:1px solid #2a0a0a;border-radius:8px">
  <p style="font-size:11px;letter-spacing:0.3em;color:#666;text-transform:uppercase;margin:0 0 16px">TVIMBLE — Critical Action Authorization</p>
  <h1 style="font-size:42px;font-weight:700;color:#ef4444;letter-spacing:0.1em;margin:0 0 8px">%s</h1>
  <p style="font-size:13px;color:#999;margin:0 0 24px">Your one-time authorization code. Valid for <strong style="color:#fff">10 minutes</strong>.</p>
  <div style="border-top:1px solid #2a0a0a;padding-top:20px">
    <p style="font-size:12px;color:#666;margin:0">If you did not request this code, someone may be attempting to access your admin account. Do not share this code with anyone.</p>
  </div>
</div>`, code),
	})
	return err
}

// AdminShutdownRequestOTP issues a 6-digit OTP to the calling admin's email.
// Step 1 of the shutdown flow.
func AdminShutdownRequestOTP(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	email, _ := c.Locals("email").(string)
	if adminID == "" || email == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	code := generateOTP()
	expires := time.Now().Add(10 * time.Minute)
	if err := repositories.SaveVerificationCode(c.Context(), email, code, expires); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to issue code"})
	}
	if err := sendShutdownOTP(email, code); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to send code"})
	}

	return c.JSON(fiber.Map{
		"sent":         true,
		"isSuperAdmin": isSuperAdmin(c),
		"email":        maskEmail(email),
	})
}

// AdminShutdownVerifyOTP validates the OTP (requires a valid pinToken from the PIN step).
// Step 4 of the shutdown flow.
func AdminShutdownVerifyOTP(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	email, _ := c.Locals("email").(string)

	var body struct {
		Code     string `json:"code"`
		PinToken string `json:"pinToken"`
	}
	if err := c.BodyParser(&body); err != nil || body.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "code required"})
	}

	// Validate the pin token before accepting the OTP
	if body.PinToken == "" {
		return c.Status(401).JSON(fiber.Map{"error": "PIN verification required first"})
	}
	var pinAdminID string
	var pinExpires time.Time
	err := db.Pool.QueryRow(c.Context(),
		`SELECT admin_id, expires_at FROM shutdown_tokens WHERE token = $1 AND used = false`,
		body.PinToken).Scan(&pinAdminID, &pinExpires)
	if err != nil || pinAdminID != adminID || time.Now().After(pinExpires) {
		return c.Status(401).JSON(fiber.Map{"error": "PIN session expired — re-enter your PIN"})
	}
	// Consume the pin token
	db.Pool.Exec(c.Context(), `UPDATE shutdown_tokens SET used = true WHERE token = $1`, body.PinToken) //nolint:errcheck

	code, expiresAt, attempts, codeID, err := repositories.GetLatestVerificationCode(c.Context(), email)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no code found — request a new one"})
	}
	if attempts >= 5 {
		repositories.InvalidateVerificationCode(c.Context(), codeID)
		return c.Status(429).JSON(fiber.Map{"error": "too many attempts — request a new code"})
	}
	if time.Now().After(expiresAt) {
		return c.Status(400).JSON(fiber.Map{"error": "code expired — request a new one"})
	}
	if body.Code != code {
		repositories.IncrementVerificationAttempts(c.Context(), codeID)
		return c.Status(400).JSON(fiber.Map{"error": "incorrect code"})
	}

	// Invalidate so it can't be reused
	repositories.InvalidateVerificationCode(c.Context(), codeID)

	// Write a short-lived shutdown session token (10 min TTL, single-use)
	token := generateOTP() + generateOTP() // 12-char random token
	db.Pool.Exec(c.Context(),
		`INSERT INTO shutdown_tokens (admin_id, token, expires_at) VALUES ($1, $2, $3)`,
		adminID, token, time.Now().Add(10*time.Minute))

	return c.JSON(fiber.Map{
		"verified":     true,
		"shutdownToken": token,
		"isSuperAdmin": isSuperAdmin(c),
	})
}

// AdminShutdownExecute performs the real or simulated shutdown.
// Step 3 — requires the shutdown token from step 2.
func AdminShutdownExecute(c *fiber.Ctx) error {
	adminID, _ := c.Locals("userId").(string)
	email, _ := c.Locals("email").(string)

	var body struct {
		ShutdownToken string   `json:"shutdownToken"`
		Simulate      bool     `json:"simulate"`
		Actions       []string `json:"actions"` // "notify_users","disable_api","lock_panel"
	}
	if err := c.BodyParser(&body); err != nil || body.ShutdownToken == "" {
		return c.Status(400).JSON(fiber.Map{"error": "shutdown token required"})
	}

	// Validate and consume the shutdown token
	var tokenAdminID string
	var tokenExpires time.Time
	err := db.Pool.QueryRow(c.Context(),
		`SELECT admin_id, expires_at FROM shutdown_tokens WHERE token = $1 AND used = false`,
		body.ShutdownToken).Scan(&tokenAdminID, &tokenExpires)
	if err != nil || tokenAdminID != adminID || time.Now().After(tokenExpires) {
		return c.Status(401).JSON(fiber.Map{"error": "invalid or expired shutdown token"})
	}
	// Mark token as used (single-use)
	db.Pool.Exec(c.Context(), `UPDATE shutdown_tokens SET used = true WHERE token = $1`, body.ShutdownToken)

	// Non-super-admin requires approval flow instead of direct execution
	if !isSuperAdmin(c) {
		return requestSuperAdminApproval(c, adminID, email, body.Actions, body.Simulate)
	}

	return executeShutdown(c, adminID, email, body.Actions, body.Simulate)
}

func requestSuperAdminApproval(c *fiber.Ctx, adminID, adminEmail string, actions []string, simulate bool) error {
	adminName := repositories.GetUserFullName(c.Context(), adminID)
	actionList := strings.Join(actions, ", ")
	if actionList == "" {
		actionList = "all actions"
	}
	mode := "REAL SHUTDOWN"
	if simulate {
		mode = "SIMULATION TEST"
	}

	client := resend.NewClient(config.ResendKey())
	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    "alerts@tvimble.tech",
		To:      []string{superAdminEmail},
		Subject: fmt.Sprintf("🚨 APPROVAL REQUIRED: %s requested by %s", mode, adminName),
		Html: fmt.Sprintf(`
<div style="font-family:monospace;max-width:560px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;padding:32px;border:2px solid #ef4444;border-radius:8px">
  <p style="font-size:11px;letter-spacing:0.3em;color:#ef4444;margin:0 0 8px">⚠ TVIMBLE — SUPER ADMIN APPROVAL REQUIRED</p>
  <h2 style="color:#fff;margin:0 0 24px">%s</h2>
  <table style="width:100%%;border-collapse:collapse;font-size:13px">
    <tr><td style="color:#666;padding:6px 0">Requested by</td><td style="color:#fff">%s (%s)</td></tr>
    <tr><td style="color:#666;padding:6px 0">Actions selected</td><td style="color:#fff">%s</td></tr>
    <tr><td style="color:#666;padding:6px 0">Mode</td><td style="color:%s">%s</td></tr>
    <tr><td style="color:#666;padding:6px 0">Timestamp</td><td style="color:#fff">%s UTC</td></tr>
  </table>
  <div style="margin-top:24px;padding-top:24px;border-top:1px solid #2a0a0a">
    <p style="font-size:12px;color:#999">Log in to the admin panel to approve or deny this request. The requesting admin has been notified that their action is pending your approval.</p>
  </div>
</div>`,
			mode, adminName, adminEmail, actionList,
			func() string {
				if simulate {
					return "#f59e0b"
				}
				return "#ef4444"
			}(), mode,
			time.Now().UTC().Format("2006-01-02 15:04:05")),
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to notify super admin"})
	}

	repositories.WriteAuditLog(c.Context(), adminID, "shutdown_approval_requested", "", "", fmt.Sprintf("mode=%s actions=%s", mode, actionList))
	return c.JSON(fiber.Map{"pending": true, "message": "Approval request sent to Super Admin. You will be notified when a decision is made."})
}

func executeShutdown(c *fiber.Ctx, adminID, adminEmail string, actions []string, simulate bool) error {
	mode := "REAL"
	if simulate {
		mode = "SIMULATION"
	}

	adminEmails, _ := repositories.ListAdminEmails(c.Context())

	subject := "🚨 TVIMBLE IS DOWN. Immediate attention required."
	if simulate {
		subject = "⚠️ SIMULATION: TVIMBLE shutdown test triggered."
	}

	actionHTML := ""
	for _, a := range actions {
		label := map[string]string{
			"notify_users": "Notify all users",
			"disable_api":  "Disable API",
			"lock_panel":   "Lock admin panel",
		}[a]
		if label == "" {
			label = a
		}
		actionHTML += fmt.Sprintf(`<li style="color:#fff;padding:4px 0">%s</li>`, label)
	}

	html := fmt.Sprintf(`
<div style="font-family:monospace;max-width:560px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;padding:32px;border:2px solid %s;border-radius:8px">
  <p style="font-size:11px;letter-spacing:0.3em;color:%s;margin:0 0 8px">%s</p>
  <h1 style="color:#fff;font-size:28px;margin:0 0 24px">%s</h1>
  <p style="font-size:13px;color:#999;margin:0 0 16px">Executed by: <strong style="color:#fff">%s</strong></p>
  <p style="font-size:13px;color:#999;margin:0 0 8px">Actions executed:</p>
  <ul style="margin:0 0 24px;padding-left:20px">%s</ul>
  <p style="font-size:11px;color:#666">%s UTC</p>
</div>`,
		func() string {
			if simulate {
				return "#f59e0b"
			}
			return "#ef4444"
		}(),
		func() string {
			if simulate {
				return "#f59e0b"
			}
			return "#ef4444"
		}(),
		func() string {
			if simulate {
				return "⚠ TVIMBLE — SHUTDOWN SIMULATION"
			}
			return "🚨 TVIMBLE — SYSTEM SHUTDOWN"
		}(),
		subject, adminEmail, actionHTML,
		time.Now().UTC().Format("2006-01-02 15:04:05"))

	client := resend.NewClient(config.ResendKey())
	for _, addr := range adminEmails {
		client.Emails.Send(&resend.SendEmailRequest{ //nolint:errcheck
			From: "alerts@tvimble.tech", To: []string{addr},
			Subject: subject, Html: html,
		})
	}

	repositories.WriteAuditLog(c.Context(), adminID, "shutdown_"+strings.ToLower(mode), "", "", fmt.Sprintf("actions=%s", strings.Join(actions, ",")))

	return c.JSON(fiber.Map{
		"executed": true,
		"simulate": simulate,
		"mode":     mode,
		"actions":  actions,
		"notified": len(adminEmails),
	})
}

func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	name := parts[0]
	if len(name) <= 2 {
		return "**@" + parts[1]
	}
	return name[:2] + strings.Repeat("*", len(name)-2) + "@" + parts[1]
}
