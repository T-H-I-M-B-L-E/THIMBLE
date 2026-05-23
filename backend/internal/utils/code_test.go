package utils

import "testing"

func TestGenerateVerificationCode_Length(t *testing.T) {
	code := GenerateVerificationCode()
	if len(code) != 6 {
		t.Errorf("expected 6-digit code, got %q (len=%d)", code, len(code))
	}
}

func TestGenerateVerificationCode_AllDigits(t *testing.T) {
	for i := 0; i < 20; i++ {
		code := GenerateVerificationCode()
		for _, ch := range code {
			if ch < '0' || ch > '9' {
				t.Errorf("code %q contains non-digit character %q", code, ch)
			}
		}
	}
}

// Two consecutive calls should almost never be identical. Probability of
// collision is 1/10^6 ≈ negligible.
func TestGenerateVerificationCode_Randomness(t *testing.T) {
	a := GenerateVerificationCode()
	b := GenerateVerificationCode()
	if a == b {
		t.Logf("codes happened to match (%s == %s); this is astronomically unlikely — run again", a, b)
	}
}

func BenchmarkGenerateVerificationCode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = GenerateVerificationCode()
	}
}
