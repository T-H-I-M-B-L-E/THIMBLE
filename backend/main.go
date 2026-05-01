package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

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

var clients = make(map[*websocket.Conn]bool)
var dbPool *pgxpool.Pool

func main() {
	var err error
	connStr := "postgresql://localhost:5432/thimble_chat"
	dbPool, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	defer dbPool.Close()

	app := fiber.New()
	app.Use(cors.New())

	// WebSocket Endpoint
	app.Get("/ws", websocket.New(func(c *websocket.Conn) {
		clients[c] = true
		log.Println("New client connected")

		// Load chat history
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
			delete(clients, c)
			c.Close()
		}()

		for {
			mt, msgBytes, err := c.ReadMessage()
			if err != nil {
				break
			}

			var msg Message
			if err := json.Unmarshal(msgBytes, &msg); err != nil {
				continue
			}

			// Save to database
			_, err = dbPool.Exec(context.Background(),
				"INSERT INTO messages (user_id, name, content, timestamp) VALUES ($1, $2, $3, $4)",
				msg.UserId, msg.Name, msg.Content, msg.Timestamp)

			// Broadcast
			for client := range clients {
				client.WriteMessage(mt, msgBytes)
			}
		}
	}))

	// Feed API Endpoints
	app.Get("/api/posts", func(c *fiber.Ctx) error {
		rows, err := dbPool.Query(context.Background(), 
			"SELECT id, user_id, author_name, author_avatar, image_url, description, likes, tagged_users, created_at FROM posts ORDER BY created_at DESC")
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		defer rows.Close()

		var posts []Post
		for rows.Next() {
			var p Post
			var taggedJSON []byte
			err := rows.Scan(&p.Id, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.ImageUrl, &p.Description, &p.Likes, &taggedJSON, &p.CreatedAt)
			if err == nil {
				json.Unmarshal(taggedJSON, &p.TaggedUsers)
				posts = append(posts, p)
			}
		}
		if posts == nil {
			posts = []Post{}
		}
		return c.JSON(posts)
	})

	app.Post("/api/posts", func(c *fiber.Ctx) error {
		var p Post
		if err := c.BodyParser(&p); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}

		taggedJSON, _ := json.Marshal(p.TaggedUsers)

		err := dbPool.QueryRow(context.Background(),
			"INSERT INTO posts (user_id, author_name, author_avatar, image_url, description, tagged_users) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at",
			p.UserId, p.AuthorName, p.AuthorAvatar, p.ImageUrl, p.Description, taggedJSON).Scan(&p.Id, &p.CreatedAt)
		
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.Status(201).JSON(p)
	})

	app.Delete("/api/posts/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		_, err := dbPool.Exec(context.Background(), "DELETE FROM posts WHERE id = $1", id)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.SendStatus(204)
	})

	app.Get("/api/gigs", func(c *fiber.Ctx) error {
		rows, err := dbPool.Query(context.Background(), 
			"SELECT id, title, description, location, payment, posted_by, posted_by_role, posted_by_avatar, applications, created_at FROM gigs ORDER BY created_at DESC")
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		defer rows.Close()

		var gigs []Gig
		for rows.Next() {
			var g Gig
			err := rows.Scan(&g.Id, &g.Title, &g.Description, &g.Location, &g.Payment, &g.PostedBy, &g.PostedByRole, &g.PostedByAvatar, &g.Applications, &g.CreatedAt)
			if err == nil {
				gigs = append(gigs, g)
			}
		}
		if gigs == nil {
			gigs = []Gig{}
		}
		return c.JSON(gigs)
	})

	log.Println("Server starting on :3001")
	log.Fatal(app.Listen(":3001"))
}
