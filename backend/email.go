package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"

	"github.com/resend/resend-go/v2"
)

func generateVerificationCode() string {
	code, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", code.Int64())
}

func sendVerificationEmail(email, code string) error {
	client := resend.NewClient(resendKey)
	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    "noreply@tvimble.tech",
		To:      []string{email},
		Subject: fmt.Sprintf("%s is your THIMBLE verification code", code),
		Html:    fmt.Sprintf(`<p>Your verification code is: <strong>%s</strong></p><p>This code expires in 10 minutes.</p>`, code),
	})
	if err == nil {
		dbPool.Exec(context.Background(), "INSERT INTO email_log (type, recipients) VALUES ('verification', 1)")
	}
	return err
}
