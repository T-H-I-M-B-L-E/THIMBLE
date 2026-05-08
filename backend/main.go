package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	clerk "github.com/clerk/clerk-sdk-go/v2"
	clerkjwt "github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Message struct {
	UserId    string `json:"userId"`
	Name      string `json:"name"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

// TypingEvent represents a typing indicator
type TypingEvent struct {
	Type           string `json:"type"` // "typing"
	ConversationId int    `json:"conversationId"`
	UserId         string `json:"userId"`
	Name           string `json:"name"`
	IsTyping       bool   `json:"isTyping"`
}

type Post struct {
	Id           int       `json:"id"`
	UserId       string    `json:"userId"`
	AuthorName   string    `json:"authorName"`
	AuthorAvatar string    `json:"authorAvatar"`
	ImageUrl     string    `json:"imageUrl"`
	Description  string    `json:"description"`
	Likes        int       `json:"likes"`
	TaggedUsers  []string  `json:"taggedUsers"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Gig struct {
	Id             int       `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Location       string    `json:"location"`
	Payment        string    `json:"payment"`
	PostedBy       string    `json:"postedBy"`
	PostedByRole   string    `json:"postedByRole"`
	PostedByAvatar string    `json:"postedByAvatar"`
	Applications   int       `json:"applications"`
	CreatedAt      time.Time `json:"createdAt"`
}

// clients maps each WebSocket connection to the authenticated userId.
var (
	clients   = make(map[*websocket.Conn]string)
	clientsMu sync.RWMutex
)

var dbPool *pgxpool.Pool

// clerkAuth validates a Bearer token and stores the subject (userId) in locals.
func clerkAuth(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")

	claims, err := clerkjwt.Verify(context.Background(), &clerkjwt.VerifyParams{Token: token})
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	c.Locals("userId", claims.Subject)
	return c.Next()
}

// wsAuth validates a token query param before upgrading to WebSocket.
func wsAuth(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	claims, err := clerkjwt.Verify(context.Background(), &clerkjwt.VerifyParams{Token: token})
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	c.Locals("userId", claims.Subject)
	return c.Next()
}

func main() {
	secretKey := os.Getenv("CLERK_SECRET_KEY")
	if secretKey == "" {
		log.Fatal("CLERK_SECRET_KEY environment variable is required")
	}
	clerk.SetKey(secretKey)

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgresql://localhost:5432/thimble_chat"
	}

	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		log.Fatal("CORS_ALLOWED_ORIGINS environment variable is required")
	}

	var err error
	dbPool, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	defer dbPool.Close()

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins: allowedOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// WebSocket — auth via ?token= query param before upgrade
	app.Get("/ws", wsAuth, websocket.New(func(c *websocket.Conn) {
		userId, _ := c.Locals("userId").(string)

		clientsMu.Lock()
		clients[c] = userId
		clientsMu.Unlock()

		log.Printf("Client connected: %s", userId)

		// Send last 50 messages as history
		rows, err := dbPool.Query(context.Background(),
			"SELECT user_id, name, content, timestamp FROM messages ORDER BY id DESC LIMIT 50")
		if err == nil {
			var history []Message
			for rows.Next() {
				var msg Message
				if err := rows.Scan(&msg.UserId, &msg.Name, &msg.Content, &msg.Timestamp); err == nil {
					history = append([]Message{msg}, history...)
				}
			}
			rows.Close()
			for _, msg := range history {
				msgBytes, _ := json.Marshal(msg)
				c.WriteMessage(websocket.TextMessage, msgBytes)
			}
		}

		defer func() {
			clientsMu.Lock()
			delete(clients, c)
			clientsMu.Unlock()
			c.Close()
		}()

		for {
			mt, msgBytes, err := c.ReadMessage()
			if err != nil {
				break
			}

			// Try to parse as a generic map first to check type
			var eventMap map[string]interface{}
			if err := json.Unmarshal(msgBytes, &eventMap); err != nil {
				continue
			}

			// Check if it's a typing event
			if eventType, ok := eventMap["type"].(string); ok && eventType == "typing" {
				// It's a typing event - just broadcast, don't save to DB
				for client := range clients {
					client.WriteMessage(mt, msgBytes)
				}
				continue
			}

			// It's a regular message
			var msg Message
			if err := json.Unmarshal(msgBytes, &msg); err != nil {
				continue
			}

			// Enforce server-side userId — ignore whatever the client sent
			msg.UserId = userId

			_, err = dbPool.Exec(context.Background(),
				"INSERT INTO messages (user_id, name, content, timestamp) VALUES ($1, $2, $3, $4)",
				msg.UserId, msg.Name, msg.Content, msg.Timestamp)
			if err != nil {
				log.Printf("Failed to save message: %v", err)
			}

			out, _ := json.Marshal(msg)

			clientsMu.RLock()
			for client := range clients {
				client.WriteMessage(mt, out)
			}
			clientsMu.RUnlock()
		}
	}))

	// Feed API — read is public, writes require auth
	app.Get("/api/posts", func(c *fiber.Ctx) error {
		limit := 20
		offset := 0
		if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 100 {
			limit = l
		}
		if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
			offset = o
		}

		rows, err := dbPool.Query(context.Background(),
			"SELECT id, user_id, author_name, author_avatar, image_url, description, likes, tagged_users, created_at FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2",
			limit, offset)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to fetch posts"})
		}
		defer rows.Close()

		var posts []Post
		for rows.Next() {
			var p Post
			var taggedJSON []byte
			if err := rows.Scan(&p.Id, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.ImageUrl, &p.Description, &p.Likes, &taggedJSON, &p.CreatedAt); err == nil {
				json.Unmarshal(taggedJSON, &p.TaggedUsers)
				posts = append(posts, p)
			}
		}
		if posts == nil {
			posts = []Post{}
		}
		return c.JSON(posts)
	})

	app.Post("/api/posts", clerkAuth, func(c *fiber.Ctx) error {
		userId, _ := c.Locals("userId").(string)

		var p Post
		if err := c.BodyParser(&p); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
		}

		// Validate required fields
		if strings.TrimSpace(p.ImageUrl) == "" {
			return c.Status(400).JSON(fiber.Map{"error": "imageUrl is required"})
		}
		if len(p.Description) > 2000 {
			return c.Status(400).JSON(fiber.Map{"error": "description exceeds 2000 characters"})
		}
		if len(p.AuthorName) > 100 {
			return c.Status(400).JSON(fiber.Map{"error": "authorName exceeds 100 characters"})
		}

		// Always use the authenticated userId — never trust the client
		p.UserId = userId
		if p.TaggedUsers == nil {
			p.TaggedUsers = []string{}
		}

		taggedJSON, _ := json.Marshal(p.TaggedUsers)

		err := dbPool.QueryRow(context.Background(),
			"INSERT INTO posts (user_id, author_name, author_avatar, image_url, description, tagged_users) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at",
			p.UserId, p.AuthorName, p.AuthorAvatar, p.ImageUrl, p.Description, taggedJSON).Scan(&p.Id, &p.CreatedAt)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to create post"})
		}

		return c.Status(201).JSON(p)
	})

	app.Delete("/api/posts/:id", clerkAuth, func(c *fiber.Ctx) error {
		userId, _ := c.Locals("userId").(string)
		postId := c.Params("id")

		result, err := dbPool.Exec(context.Background(),
			"DELETE FROM posts WHERE id = $1 AND user_id = $2", postId, userId)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to delete post"})
		}
		if result.RowsAffected() == 0 {
			return c.Status(404).JSON(fiber.Map{"error": "post not found or not yours"})
		}

		return c.SendStatus(204)
	})

	app.Get("/api/gigs", func(c *fiber.Ctx) error {
		rows, err := dbPool.Query(context.Background(),
			"SELECT id, title, description, location, payment, posted_by, posted_by_role, posted_by_avatar, applications, created_at FROM gigs ORDER BY created_at DESC")
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to fetch gigs"})
		}
		defer rows.Close()

		var gigs []Gig
		for rows.Next() {
			var g Gig
			if err := rows.Scan(&g.Id, &g.Title, &g.Description, &g.Location, &g.Payment, &g.PostedBy, &g.PostedByRole, &g.PostedByAvatar, &g.Applications, &g.CreatedAt); err == nil {
				gigs = append(gigs, g)
			}
		}
		if gigs == nil {
			gigs = []Gig{}
		}
		return c.JSON(gigs)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Server starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
