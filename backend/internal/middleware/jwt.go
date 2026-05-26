package middleware

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"chat-app/internal/config"
	"chat-app/internal/db"
)

type Claims struct {
	UserID       string `json:"userId"`
	Email        string `json:"email"`
	TokenVersion int    `json:"tv"`
	jwt.RegisteredClaims
}

// GenerateJWT signs a 7-day token for the given user. tokenVersion is
// stamped into the claim and re-checked on every authed request; bumping
// users.token_version invalidates every JWT issued before the bump.
func GenerateJWT(userID, email string, tokenVersion int) (string, error) {
	claims := &Claims{
		UserID:       userID,
		Email:        email,
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "thimble",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.JWTSecret()))
}

// ValidateJWT parses and verifies tokenString. The returned *Claims is
// populated even when the token is invalid; check err first.
func ValidateJWT(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return []byte(config.JWTSecret()), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return claims, nil
}

// RequireJWT pulls the token from Authorization or auth_token cookie and
// stores userId/email in c.Locals. Rejects with 401 if missing/invalid.
//
// Performs a single indexed PK lookup per request to compare the JWT's
// token_version against the user's current value. A future optimization
// could cache this in-process with a short TTL.
func RequireJWT(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	var tokenString string
	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	} else if token := c.Cookies("auth_token"); token != "" {
		tokenString = token
	} else {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := ValidateJWT(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	if db.Pool != nil {
		var currentVersion int
		if err := db.Pool.QueryRow(c.Context(),
			"SELECT token_version FROM users WHERE id = $1", claims.UserID).
			Scan(&currentVersion); err != nil || currentVersion != claims.TokenVersion {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
	}
	c.Locals("userId", claims.UserID)
	c.Locals("email", claims.Email)
	return c.Next()
}

// OptionalJWT populates userId/email locals when a valid token is
// present and silently continues otherwise. Use on public endpoints
// that want to personalize the response when the caller is signed in.
func OptionalJWT(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	var tokenString string
	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	} else if token := c.Cookies("auth_token"); token != "" {
		tokenString = token
	} else {
		return c.Next()
	}
	claims, err := ValidateJWT(tokenString)
	if err != nil {
		return c.Next()
	}
	if db.Pool != nil {
		var currentVersion int
		if err := db.Pool.QueryRow(c.Context(),
			"SELECT token_version FROM users WHERE id = $1", claims.UserID).
			Scan(&currentVersion); err != nil || currentVersion != claims.TokenVersion {
			return c.Next()
		}
	}
	c.Locals("userId", claims.UserID)
	c.Locals("email", claims.Email)
	return c.Next()
}
