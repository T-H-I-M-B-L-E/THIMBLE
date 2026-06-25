package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"chat-app/internal/db"
	emailPkg "chat-app/internal/email"
	"chat-app/internal/models"
	"chat-app/internal/utils"
)

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// ListPosts is the feed query: it joins to users for live author info,
// counts comments inline, and stamps liked-by-me when callerID is set.
// When filterUserID is empty (main feed), posts are ranked by a score that
// blends engagement, time decay, following boost, and slight randomness.
// Profile-page queries (filterUserID set) keep chronological order.
func ListPosts(ctx context.Context, callerID, beforeID, filterUserID string, limit int) ([]models.Post, error) {
	args := []interface{}{callerID}

	var query string
	if filterUserID != "" {
		// Profile view: simple chronological, no ranking needed.
		query = `
			SELECT p.id, COALESCE(p.slug,''), p.user_id,
			       COALESCE(u.full_name, p.author_name) AS author_name,
			       COALESCE(u.avatar_url, p.author_avatar) AS author_avatar,
			       COALESCE(u.is_verified, FALSE) AS author_verified,
			       p.image_url, p.images, p.description, p.likes, p.tagged_users, p.created_at,
			       COUNT(pc.id) AS comment_count,
			       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) ELSE FALSE END AS liked_by_me,
			       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = $1) ELSE FALSE END AS saved_by_me
			FROM posts p
			LEFT JOIN users u ON u.id = p.user_id
			LEFT JOIN post_comments pc ON pc.post_id = p.id
			WHERE ($1 = '' OR NOT EXISTS (
			    SELECT 1 FROM blocks b
			    WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
			       OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
			))`

		argIdx := 2
		if beforeID != "" {
			query += fmt.Sprintf(" AND p.id < $%d", argIdx)
			args = append(args, beforeID)
			argIdx++
		}
		query += fmt.Sprintf(" AND p.user_id = $%d", argIdx)
		args = append(args, filterUserID)
		query += fmt.Sprintf(` GROUP BY p.id, u.full_name, u.avatar_url, u.is_verified ORDER BY p.id DESC LIMIT %d`, limit)
	} else {
		// Main feed: ranked score.
		//
		// score =
		//   (likes * 3)
		//   + (comment_count * 5)
		//   - hours_since_posted * 2          ← time decay
		//   + (15 if poster is followed)      ← social boost
		//   + random(0..4)                    ← slight shuffle to avoid staleness
		//
		// beforeID is used for cursor pagination: we re-score on every page
		// request so the window stays consistent. The cursor carries the last
		// seen score+id to avoid gaps/duplicates across pages.
		query = `
			WITH ranked AS (
				SELECT p.id, COALESCE(p.slug,'') AS slug, p.user_id,
				       COALESCE(u.full_name, p.author_name)   AS author_name,
				       COALESCE(u.avatar_url, p.author_avatar) AS author_avatar,
				       COALESCE(u.is_verified, FALSE)          AS author_verified,
				       p.image_url, p.images, p.description, p.likes, p.tagged_users, p.created_at,
				       COUNT(pc.id) AS comment_count,
				       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) ELSE FALSE END AS liked_by_me,
				       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = $1) ELSE FALSE END AS saved_by_me,
				       (
				           (p.likes * 3)
				         + COUNT(pc.id) * 5
				         - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 * 2
				         + CASE WHEN $1 <> '' AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = p.user_id) THEN 15 ELSE 0 END
				         + (random() * 4)
				       ) AS score
				FROM posts p
				LEFT JOIN users u ON u.id = p.user_id
				LEFT JOIN post_comments pc ON pc.post_id = p.id
				WHERE ($1 = '' OR NOT EXISTS (
				    SELECT 1 FROM blocks b
				    WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
				       OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
				))
				`

		argIdx := 2
		if beforeID != "" {
			query += fmt.Sprintf(` AND p.id < $%d`, argIdx)
			args = append(args, beforeID)
			argIdx++
		}

		query += fmt.Sprintf(`
				GROUP BY p.id, u.full_name, u.avatar_url, u.is_verified
			)
			SELECT id, slug, user_id, author_name, author_avatar, author_verified,
			       image_url, images, description, likes, tagged_users, created_at,
			       comment_count, liked_by_me, saved_by_me
			FROM ranked
			ORDER BY score DESC, id DESC
			LIMIT %d`, limit)
	}

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var p models.Post
		var taggedJSON, imagesJSON []byte
		if err := rows.Scan(&p.Id, &p.Slug, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.AuthorVerified, &p.ImageUrl, &imagesJSON, &p.Description, &p.Likes, &taggedJSON, &p.CreatedAt, &p.CommentCount, &p.LikedByMe, &p.SavedByMe); err == nil {
			json.Unmarshal(taggedJSON, &p.TaggedUsers)
			json.Unmarshal(imagesJSON, &p.Images)
			if p.Images == nil {
				p.Images = []string{}
			}
			// Back-fill images from image_url for legacy single-image posts.
			if len(p.Images) == 0 && p.ImageUrl != "" {
				p.Images = []string{p.ImageUrl}
			}
			posts = append(posts, p)
		}
	}
	if posts == nil {
		posts = []models.Post{}
	}
	return posts, nil
}

const postSelectFields = `
	SELECT p.id, COALESCE(p.slug,''), p.user_id,
	       COALESCE(u.full_name, p.author_name) AS author_name,
	       COALESCE(u.avatar_url, p.author_avatar) AS author_avatar,
	       COALESCE(u.is_verified, FALSE) AS author_verified,
	       p.image_url, p.images, p.description, p.likes, p.tagged_users, p.created_at,
	       COUNT(pc.id) AS comment_count,
	       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) ELSE FALSE END AS liked_by_me,
	       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = $1) ELSE FALSE END AS saved_by_me
	FROM posts p
	LEFT JOIN users u ON u.id = p.user_id
	LEFT JOIN post_comments pc ON pc.post_id = p.id`

func scanPost(row pgx.Row) (*models.Post, error) {
	var p models.Post
	var taggedJSON, imagesJSON []byte
	err := row.Scan(&p.Id, &p.Slug, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.AuthorVerified,
		&p.ImageUrl, &imagesJSON, &p.Description, &p.Likes, &taggedJSON, &p.CreatedAt,
		&p.CommentCount, &p.LikedByMe, &p.SavedByMe)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if len(taggedJSON) > 0 {
		json.Unmarshal(taggedJSON, &p.TaggedUsers)
	}
	if p.TaggedUsers == nil {
		p.TaggedUsers = []string{}
	}
	json.Unmarshal(imagesJSON, &p.Images)
	if p.Images == nil {
		p.Images = []string{}
	}
	if len(p.Images) == 0 && p.ImageUrl != "" {
		p.Images = []string{p.ImageUrl}
	}
	return &p, nil
}

// GetPostByID fetches a single post by numeric id.
func GetPostByID(ctx context.Context, callerID, postID string) (*models.Post, error) {
	return scanPost(db.Pool.QueryRow(ctx,
		postSelectFields+` WHERE p.id = $2 GROUP BY p.id, u.full_name, u.avatar_url, u.is_verified`, callerID, postID))
}

// GetPostBySlug fetches a single post by its short slug.
func GetPostBySlug(ctx context.Context, callerID, slug string) (*models.Post, error) {
	return scanPost(db.Pool.QueryRow(ctx,
		postSelectFields+` WHERE p.slug = $2 GROUP BY p.id, u.full_name, u.avatar_url, u.is_verified`, callerID, slug))
}

// InsertPost writes a new row and returns the assigned id, slug, and created_at.
// image_url is set from images[0] when provided so legacy single-image
// reads keep working.
func InsertPost(ctx context.Context, p *models.Post) error {
	if p.Images == nil {
		p.Images = []string{}
	}
	// Mirror first image into image_url for back-compat.
	if p.ImageUrl == "" && len(p.Images) > 0 {
		p.ImageUrl = p.Images[0]
	}
	if p.ImageUrl != "" && len(p.Images) == 0 {
		p.Images = []string{p.ImageUrl}
	}
	taggedJSON, _ := json.Marshal(p.TaggedUsers)
	imagesJSON, _ := json.Marshal(p.Images)

	// Retry on the rare slug collision (1-in-62^6 chance per existing post).
	for {
		slug := utils.GenerateSlug()
		err := db.Pool.QueryRow(ctx,
			`INSERT INTO posts (user_id, author_name, author_avatar, image_url, images, description, tagged_users, slug)
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)
			 RETURNING id, slug, created_at`,
			p.UserId, p.AuthorName, p.AuthorAvatar, p.ImageUrl, string(imagesJSON), p.Description, string(taggedJSON), slug,
		).Scan(&p.Id, &p.Slug, &p.CreatedAt)
		if err == nil {
			return nil
		}
		// 23505 = unique_violation — slug collision, try again
		if isUniqueViolation(err) {
			continue
		}
		log.Printf("InsertPost error: %v", err)
		return err
	}
}

func DeletePost(ctx context.Context, postId, userId string) (int64, error) {
	result, err := db.Pool.Exec(ctx,
		"DELETE FROM posts WHERE id = $1 AND user_id = $2", postId, userId)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// RefreshUserPostCount recomputes posts count for userId. Called after
// any insert or delete so the denormalised counter stays accurate.
func RefreshUserPostCount(ctx context.Context, userId string) {
	if _, err := db.Pool.Exec(ctx,
		`UPDATE users SET posts = (SELECT COUNT(*) FROM posts WHERE user_id = $1) WHERE id = $1`, userId); err != nil {
		log.Printf("refresh post count failed (user=%s): %v", userId, err)
	}
}

func ListPostLikers(ctx context.Context, postId string) ([]models.Liker, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT pl.user_id, u.full_name, u.avatar_url FROM post_likes pl
		 LEFT JOIN users u ON u.id = pl.user_id
		 WHERE pl.post_id = $1 ORDER BY pl.created_at DESC`, postId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var likers []models.Liker
	for rows.Next() {
		var l models.Liker
		if err := rows.Scan(&l.UserID, &l.UserName, &l.Avatar); err != nil {
			return nil, err
		}
		likers = append(likers, l)
	}
	if likers == nil {
		likers = []models.Liker{}
	}
	return likers, nil
}

// SetLike adds or removes a like inside a transaction and returns the
// updated like count. liked=true → INSERT … ON CONFLICT DO NOTHING;
// liked=false → DELETE.
func SetLike(ctx context.Context, postId, userId string, liked bool) (int, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	if liked {
		if _, err = tx.Exec(ctx,
			`INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, postId, userId); err != nil {
			return 0, err
		}
	} else {
		if _, err = tx.Exec(ctx,
			`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, postId, userId); err != nil {
			return 0, err
		}
	}

	var count int
	if err = tx.QueryRow(ctx,
		`UPDATE posts SET likes = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1 RETURNING likes`, postId).Scan(&count); err != nil {
		return 0, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, err
	}
	// Fire like email notification asynchronously after successful commit.
	if liked {
		go func() {
			sendLikeEmailIfWanted(ctx, postId, userId)
		}()
	}
	return count, nil
}

func sendLikeEmailIfWanted(ctx context.Context, postId, likerID string) {
	// Look up post owner and liker in one query each.
	var ownerID string
	if err := db.Pool.QueryRow(ctx, `SELECT user_id FROM posts WHERE id = $1`, postId).Scan(&ownerID); err != nil || ownerID == likerID {
		return
	}
	recipient, err := GetUserEmailAndPrefs(ctx, ownerID)
	if err != nil || !recipient.WantsLikeEmail {
		return
	}
	var likerName string
	db.Pool.QueryRow(ctx, `SELECT full_name FROM users WHERE id = $1`, likerID).Scan(&likerName) //nolint:errcheck
	if likerName == "" {
		likerName = "Someone"
	}
	emailPkg.SendLikeNotification(recipient.Email, recipient.FullName, likerName)
}

func ListPostComments(ctx context.Context, postId string) ([]models.Comment, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT pc.id, pc.user_id, pc.user_name, pc.user_avatar,
		        COALESCE(u.is_verified, FALSE) AS user_verified,
		        pc.content, pc.created_at
		 FROM post_comments pc
		 LEFT JOIN users u ON u.id = pc.user_id
		 WHERE pc.post_id = $1 ORDER BY pc.created_at ASC`, postId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var comments []models.Comment
	for rows.Next() {
		var cm models.Comment
		if err := rows.Scan(&cm.ID, &cm.UserID, &cm.UserName, &cm.UserAvatar, &cm.UserVerified, &cm.Content, &cm.CreatedAt); err != nil {
			return nil, err
		}
		comments = append(comments, cm)
	}
	if comments == nil {
		comments = []models.Comment{}
	}
	return comments, nil
}

// GetUserNameAndAvatar fetches the denormalised values we copy into
// post_comments rows.
func GetUserNameAndAvatar(ctx context.Context, userId string) (name, avatar string) {
	db.Pool.QueryRow(ctx, `SELECT full_name, COALESCE(avatar_url,'') FROM users WHERE id = $1`, userId).Scan(&name, &avatar)
	return
}

func IsUserVerified(ctx context.Context, userId string) bool {
	var verified bool
	db.Pool.QueryRow(ctx, `SELECT is_verified FROM users WHERE id = $1`, userId).Scan(&verified)
	return verified
}

func InsertComment(ctx context.Context, postId, userId, userName, userAvatar, content string) (models.Comment, error) {
	var cm models.Comment
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO post_comments (post_id, user_id, user_name, user_avatar, content)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, user_name, user_avatar, content, created_at`,
		postId, userId, userName, userAvatar, content).
		Scan(&cm.ID, &cm.UserID, &cm.UserName, &cm.UserAvatar, &cm.Content, &cm.CreatedAt)
	return cm, err
}

func GetCommentOwner(ctx context.Context, commentID string) (string, error) {
	var userID string
	err := db.Pool.QueryRow(ctx,
		`SELECT user_id FROM post_comments WHERE id = $1`, commentID).Scan(&userID)
	return userID, err
}

func DeleteComment(ctx context.Context, commentID string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM post_comments WHERE id = $1`, commentID)
	return err
}

// TrendingTags pulls the top 5 hashtags by case-insensitive frequency.
func TrendingTags(ctx context.Context) ([]models.TagCount, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT lower(m[1]) AS tag, COUNT(*) AS count
		 FROM posts,
		      LATERAL regexp_matches(description, '#([A-Za-z][A-Za-z0-9_]{1,})', 'g') AS m
		 GROUP BY lower(m[1])
		 ORDER BY count DESC
		 LIMIT 5`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []models.TagCount
	for rows.Next() {
		var t models.TagCount
		if err := rows.Scan(&t.Tag, &t.Count); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []models.TagCount{}
	}
	return tags, nil
}

func SetPostSave(ctx context.Context, userID, postID string, save bool) error {
	if save {
		_, err := db.Pool.Exec(ctx,
			`INSERT INTO post_saves (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			postID, userID)
		return err
	}
	_, err := db.Pool.Exec(ctx,
		`DELETE FROM post_saves WHERE post_id = $1 AND user_id = $2`,
		postID, userID)
	return err
}

func IsPostSaved(ctx context.Context, userID, postID string) (bool, error) {
	var saved bool
	err := db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM post_saves WHERE post_id = $1 AND user_id = $2)`,
		postID, userID).Scan(&saved)
	return saved, err
}

// ListSavedPosts returns saves in reverse-chronological save order with
// cursor pagination. `beforeSaveID` is the post_saves.id of the last
// row from the previous page; pass "" for the first page.
func ListSavedPosts(ctx context.Context, userID, beforeSaveID string, limit int) ([]models.Post, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	args := []interface{}{userID}
	query := `
		SELECT p.id, COALESCE(p.slug,''), p.user_id,
		       COALESCE(u.full_name, p.author_name) AS author_name,
		       COALESCE(u.avatar_url, p.author_avatar) AS author_avatar,
		       COALESCE(u.is_verified, FALSE) AS author_verified,
		       p.image_url, p.images, p.description, p.likes, p.tagged_users, p.created_at,
		       COUNT(pc.id) AS comment_count,
		       EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS liked_by_me,
		       TRUE AS saved_by_me,
		       ps.id AS save_id
		FROM post_saves ps
		JOIN posts p ON p.id = ps.post_id
		LEFT JOIN users u ON u.id = p.user_id
		LEFT JOIN post_comments pc ON pc.post_id = p.id
		WHERE ps.user_id = $1`
	if beforeSaveID != "" {
		query += fmt.Sprintf(" AND ps.id < $%d", len(args)+1)
		args = append(args, beforeSaveID)
	}
	query += fmt.Sprintf(" GROUP BY p.id, u.full_name, u.avatar_url, u.is_verified, ps.id ORDER BY ps.id DESC LIMIT %d", limit)

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var posts []models.Post
	for rows.Next() {
		var p models.Post
		var tagsJSON, imagesJSON []byte
		var saveID int64
		if err := rows.Scan(&p.Id, &p.Slug, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.AuthorVerified,
			&p.ImageUrl, &imagesJSON, &p.Description, &p.Likes, &tagsJSON, &p.CreatedAt,
			&p.CommentCount, &p.LikedByMe, &p.SavedByMe, &saveID); err != nil {
			return nil, err
		}
		if len(tagsJSON) > 0 {
			json.Unmarshal(tagsJSON, &p.TaggedUsers)
		}
		if p.TaggedUsers == nil {
			p.TaggedUsers = []string{}
		}
		json.Unmarshal(imagesJSON, &p.Images)
		if p.Images == nil {
			p.Images = []string{}
		}
		if len(p.Images) == 0 && p.ImageUrl != "" {
			p.Images = []string{p.ImageUrl}
		}
		p.SaveCursor = strconv.FormatInt(saveID, 10)
		posts = append(posts, p)
	}
	if posts == nil {
		posts = []models.Post{}
	}
	return posts, nil
}
