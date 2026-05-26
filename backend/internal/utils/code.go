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

const slugAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// GenerateSlug returns a random 6-character base62 string for use as a
// short, human-readable post identifier (e.g. "aB3kR9").
func GenerateSlug() string {
	b := make([]byte, 6)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(slugAlphabet))))
		b[i] = slugAlphabet[n.Int64()]
	}
	return string(b)
}
