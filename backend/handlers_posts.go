package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func handleListPosts(c *fiber.Ctx) error {
	callerID := ""
	authHeader := c.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		if claims, err := validateJWT(strings.TrimPrefix(authHeader, "Bearer ")); err == nil {
			callerID = claims.UserID
		}
	} else if tok := c.Cookies("auth_token"); tok != "" {
		if claims, err := validateJWT(tok); err == nil {
			callerID = claims.UserID
		}
	}

	limit := 20
	beforeID := c.Query("before", "")
	filterUserID := c.Query("userId", "")

	args := []interface{}{callerID}
	query := `
		SELECT p.id, p.user_id,
		       COALESCE(u.full_name, p.author_name) AS author_name,
		       COALESCE(u.avatar_url, p.author_avatar) AS author_avatar,
		       p.image_url, p.description, p.likes, p.tagged_users, p.created_at,
		       (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
		       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) ELSE FALSE END AS liked_by_me
		FROM posts p
		LEFT JOIN users u ON u.id = p.user_id
		WHERE 1=1`

	argIdx := 2
	if beforeID != "" {
		query += fmt.Sprintf(" AND p.id < $%d", argIdx)
		args = append(args, beforeID)
		argIdx++
	}
	if filterUserID != "" {
		query += fmt.Sprintf(" AND p.user_id = $%d", argIdx)
		args = append(args, filterUserID)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY p.id DESC LIMIT %d", limit)

	rows, err := dbPool.Query(context.Background(), query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch posts"})
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var p Post
		var taggedJSON []byte
		if err := rows.Scan(&p.Id, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.ImageUrl, &p.Description, &p.Likes, &taggedJSON, &p.CreatedAt, &p.CommentCount, &p.LikedByMe); err == nil {
			json.Unmarshal(taggedJSON, &p.TaggedUsers)
			posts = append(posts, p)
		}
	}
	if posts == nil {
		posts = []Post{}
	}
	return c.JSON(posts)
}

func handleCreatePost(c *fiber.Ctx) error {
	userId, _ := c.Locals("userId").(string)

	var p Post
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if strings.TrimSpace(p.ImageUrl) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "imageUrl is required"})
	}

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

	dbPool.Exec(context.Background(),
		`UPDATE users SET posts = (SELECT COUNT(*) FROM posts WHERE user_id = $1) WHERE id = $1`, p.UserId)

	return c.Status(201).JSON(p)
}

func handleDeletePost(c *fiber.Ctx) error {
	userId, _ := c.Locals("userId").(string)
	postId := c.Params("id")
	ctx := context.Background()

	result, err := dbPool.Exec(ctx,
		"DELETE FROM posts WHERE id = $1 AND user_id = $2", postId, userId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete post"})
	}
	if result.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "post not found"})
	}

	dbPool.Exec(ctx,
		`UPDATE users SET posts = (SELECT COUNT(*) FROM posts WHERE user_id = $1) WHERE id = $1`, userId)

	return c.SendStatus(204)
}

func handleGetPostLikes(c *fiber.Ctx) error {
	postId := c.Params("id")
	rows, err := dbPool.Query(context.Background(),
		`SELECT pl.user_id, u.full_name, u.avatar_url FROM post_likes pl
		 LEFT JOIN users u ON u.id = pl.user_id
		 WHERE pl.post_id = $1 ORDER BY pl.created_at DESC`, postId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch likes"})
	}
	defer rows.Close()
	type Liker struct {
		UserID   string `json:"userId"`
		UserName string `json:"userName"`
		Avatar   string `json:"avatar"`
	}
	var likers []Liker
	for rows.Next() {
		var l Liker
		rows.Scan(&l.UserID, &l.UserName, &l.Avatar)
		likers = append(likers, l)
	}
	if likers == nil {
		likers = []Liker{}
	}
	return c.JSON(likers)
}

func handleLikePost(c *fiber.Ctx) error {
	userId, _ := c.Locals("userId").(string)
	postId := c.Params("id")
	_, err := dbPool.Exec(context.Background(),
		`INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, postId, userId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to like post"})
	}
	dbPool.Exec(context.Background(), `UPDATE posts SET likes = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1`, postId)
	var count int
	dbPool.QueryRow(context.Background(), `SELECT likes FROM posts WHERE id = $1`, postId).Scan(&count)
	return c.JSON(fiber.Map{"likes": count})
}

func handleUnlikePost(c *fiber.Ctx) error {
	userId, _ := c.Locals("userId").(string)
	postId := c.Params("id")
	dbPool.Exec(context.Background(),
		`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, postId, userId)
	dbPool.Exec(context.Background(), `UPDATE posts SET likes = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1`, postId)
	var count int
	dbPool.QueryRow(context.Background(), `SELECT likes FROM posts WHERE id = $1`, postId).Scan(&count)
	return c.JSON(fiber.Map{"likes": count})
}

type CommentOut struct {
	ID         int64     `json:"id"`
	UserID     string    `json:"userId"`
	UserName   string    `json:"userName"`
	UserAvatar string    `json:"userAvatar"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"createdAt"`
}

func handleGetPostComments(c *fiber.Ctx) error {
	postId := c.Params("id")
	rows, err := dbPool.Query(context.Background(),
		`SELECT id, user_id, user_name, user_avatar, content, created_at
		 FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC`, postId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch comments"})
	}
	defer rows.Close()
	var comments []CommentOut
	for rows.Next() {
		var cm CommentOut
		rows.Scan(&cm.ID, &cm.UserID, &cm.UserName, &cm.UserAvatar, &cm.Content, &cm.CreatedAt)
		comments = append(comments, cm)
	}
	if comments == nil {
		comments = []CommentOut{}
	}
	return c.JSON(comments)
}

func handleCreatePostComment(c *fiber.Ctx) error {
	userId, _ := c.Locals("userId").(string)
	postId := c.Params("id")

	var body struct {
		Content string `json:"content"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Content) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "content is required"})
	}

	var userName, userAvatar string
	dbPool.QueryRow(context.Background(), `SELECT full_name, COALESCE(avatar_url,'') FROM users WHERE id = $1`, userId).Scan(&userName, &userAvatar)

	var cm CommentOut
	err := dbPool.QueryRow(context.Background(),
		`INSERT INTO post_comments (post_id, user_id, user_name, user_avatar, content)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, user_name, user_avatar, content, created_at`,
		postId, userId, userName, userAvatar, strings.TrimSpace(body.Content)).
		Scan(&cm.ID, &cm.UserID, &cm.UserName, &cm.UserAvatar, &cm.Content, &cm.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to post comment"})
	}
	return c.Status(201).JSON(cm)
}
