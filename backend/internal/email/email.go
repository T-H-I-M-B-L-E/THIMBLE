package email

import (
	"context"
	"fmt"

	"github.com/resend/resend-go/v2"

	"chat-app/internal/config"
	"chat-app/internal/db"
)

// SendVerification sends a 6-digit code to email via Resend and records
// the send in email_log on success.
func SendVerification(email, code string) error {
	client := resend.NewClient(config.ResendKey())
	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      []string{email},
		Subject: fmt.Sprintf("%s is your THIMBLE verification code", code),
		Html:    fmt.Sprintf(`<p>Your verification code is: <strong>%s</strong></p><p>This code expires in 10 minutes.</p>`, code),
	})
	if err == nil {
		db.Pool.Exec(context.Background(), "INSERT INTO email_log (type, recipients) VALUES ('verification', 1)")
	}
	return err
}
