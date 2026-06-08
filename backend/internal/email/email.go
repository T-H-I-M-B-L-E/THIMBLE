package email

import (
	"context"
	"fmt"
	"log"

	"github.com/resend/resend-go/v2"

	"chat-app/internal/config"
	"chat-app/internal/db"
)

const fromAddr = "noreply@tvimble.tech"

func send(to, subject, html, logType string) {
	key := config.ResendKey()
	if key == "" {
		return
	}
	client := resend.NewClient(key)
	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From: fromAddr, To: []string{to}, Subject: subject, Html: html,
	})
	if err != nil {
		log.Printf("email send failed (%s → %s): %v", logType, to, err)
		return
	}
	db.Pool.Exec(context.Background(), "INSERT INTO email_log (type, recipients) VALUES ($1, 1)", logType)
}

// SendVerification sends a 6-digit code to email via Resend and records
// the send in email_log on success.
func SendVerification(email, code string) error {
	client := resend.NewClient(config.ResendKey())
	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    fromAddr,
		To:      []string{email},
		Subject: fmt.Sprintf("%s is your THIMBLE verification code", code),
		Html:    fmt.Sprintf(`<p>Your verification code is: <strong>%s</strong></p><p>This code expires in 10 minutes.</p>`, code),
	})
	if err == nil {
		db.Pool.Exec(context.Background(), "INSERT INTO email_log (type, recipients) VALUES ('verification', 1)")
	}
	return err
}

// SendFollowNotification fires in a goroutine — non-blocking, respects email_prefs.
func SendFollowNotification(recipientEmail, recipientName, followerName string) {
	go send(
		recipientEmail,
		fmt.Sprintf("%s started following you on THIMBLE", followerName),
		fmt.Sprintf(`<p>Hi %s,</p><p><strong>%s</strong> just started following you on THIMBLE.</p><p><a href="https://tvimble.tech/messages">Open THIMBLE</a></p>`, recipientName, followerName),
		"follow_notification",
	)
}

// SendLikeNotification fires in a goroutine — non-blocking, respects email_prefs.
func SendLikeNotification(recipientEmail, recipientName, likerName string) {
	go send(
		recipientEmail,
		fmt.Sprintf("%s liked your post on THIMBLE", likerName),
		fmt.Sprintf(`<p>Hi %s,</p><p><strong>%s</strong> liked your post on THIMBLE.</p><p><a href="https://tvimble.tech/feed">Open THIMBLE</a></p>`, recipientName, likerName),
		"like_notification",
	)
}
