package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// GenerateVerificationCode returns a zero-padded 6-digit code suitable
// for short-lived email confirmation. Sourced from crypto/rand.
func GenerateVerificationCode() string {
	code, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", code.Int64())
}
