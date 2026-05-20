package main

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func generateJWT(userID, email string) (string, error) {
	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "thimble",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func validateJWT(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return claims, nil
}

func jwtAuth(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	var tokenString string
	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	} else if token := c.Cookies("auth_token"); token != "" {
		tokenString = token
	} else {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := validateJWT(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	c.Locals("userId", claims.UserID)
	c.Locals("email", claims.Email)
	return c.Next()
}

func adminAuth(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var isAdmin bool
	err := dbPool.QueryRow(context.Background(),
		"SELECT is_admin FROM users WHERE id = $1", userId).Scan(&isAdmin)
	if err != nil || !isAdmin {
		return c.Status(403).JSON(fiber.Map{"error": "forbidden: admin access required"})
	}
	return c.Next()
}

func handleIssueWSTicket(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	ticket := uuid.New().String()
	wsTicketsMu.Lock()
	wsTickets[ticket] = wsTicket{UserID: userId, ExpiresAt: time.Now().Add(60 * time.Second)}
	wsTicketsMu.Unlock()
	return c.JSON(fiber.Map{"ticket": ticket})
}

func sweepExpiredTickets() {
	for range time.Tick(5 * time.Minute) {
		now := time.Now()
		wsTicketsMu.Lock()
		for k, t := range wsTickets {
			if now.After(t.ExpiresAt) {
				delete(wsTickets, k)
			}
		}
		wsTicketsMu.Unlock()
	}
}

// wsAuth accepts a one-time ticket (preferred) or a JWT token (legacy).
func wsAuth(c *fiber.Ctx) error {
	if ticket := c.Query("ticket"); ticket != "" {
		wsTicketsMu.Lock()
		t, ok := wsTickets[ticket]
		if ok {
			delete(wsTickets, ticket)
		}
		wsTicketsMu.Unlock()
		if !ok || time.Now().After(t.ExpiresAt) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		c.Locals("userId", t.UserID)
		return c.Next()
	}
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := validateJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	c.Locals("userId", claims.UserID)
	return c.Next()
}

func wsAdminAuth(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := validateJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	var isAdmin bool
	dbPool.QueryRow(context.Background(), "SELECT is_admin FROM users WHERE id = $1", claims.UserID).Scan(&isAdmin)
	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	c.Locals("userId", claims.UserID)
	return c.Next()
}
