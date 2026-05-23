package utils

import "regexp"

// Usernames: 3–30 chars, lower-case letters/digits/underscore/dot. No
// leading or trailing punctuation, no doubled punctuation.
var UsernameRe = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])?$`)

// UsernameCooldownDays is how long a user must wait between username changes.
const UsernameCooldownDays = 30

// ExtractUsername returns the local-part of an email address ("a@b.com" → "a").
func ExtractUsername(email string) string {
	for i, ch := range email {
		if ch == '@' {
			return email[:i]
		}
	}
	return email
}
