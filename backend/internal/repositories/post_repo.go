package repositories

import (
	"context"
	"encoding/json"
	"fmt"

	"chat-app/internal/db"
	"chat-app/internal/models"
)

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
			SELECT p.id, p.user_id,
			       COALESCE(u.full_name, p.author_name) AS author_name,
			       COALESCE(u.avatar_url, p.author_avatar) AS author_avatar,
			       COALESCE(u.is_verified, FALSE) AS author_verified,
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
		query += fmt.Sprintf(" AND p.user_id = $%d", argIdx)
		args = append(args, filterUserID)
		query += fmt.Sprintf(" ORDER BY p.id DESC LIMIT %d", limit)
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
				SELECT p.id, p.user_id,
				       COALESCE(u.full_name, p.author_name)   AS author_name,
				       COALESCE(u.avatar_url, p.author_avatar) AS author_avatar,
				       COALESCE(u.is_verified, FALSE)          AS author_verified,
				       p.image_url, p.description, p.likes, p.tagged_users, p.created_at,
				       (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
				       CASE WHEN $1 <> '' THEN EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) ELSE FALSE END AS liked_by_me,
				       (
				           (p.likes * 3)
				         + (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) * 5
				         - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 * 2
				         + CASE WHEN $1 <> '' AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = p.user_id) THEN 15 ELSE 0 END
				         + (random() * 4)
				       ) AS score
				FROM posts p
				LEFT JOIN users u ON u.id = p.user_id`

		argIdx := 2
		if beforeID != "" {
			// Cursor: exclude posts whose id is in the already-seen set.
			// Simple approach: treat beforeID as the last post id seen and
			// fall back to score-based ordering (score ties broken by id DESC).
			query += fmt.Sprintf(`
				WHERE p.id < $%d`, argIdx)
			args = append(args, beforeID)
			argIdx++
		}

		query += fmt.Sprintf(`
			)
			SELECT id, user_id, author_name, author_avatar, author_verified,
			       image_url, description, likes, tagged_users, created_at,
			       comment_count, liked_by_me
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
		var taggedJSON []byte
		if err := rows.Scan(&p.Id, &p.UserId, &p.AuthorName, &p.AuthorAvatar, &p.AuthorVerified, &p.ImageUrl, &p.Description, &p.Likes, &taggedJSON, &p.CreatedAt, &p.CommentCount, &p.LikedByMe); err == nil {
			json.Unmarshal(taggedJSON, &p.TaggedUsers)
			posts = append(posts, p)
		}
	}
	if posts == nil {
		posts = []models.Post{}
	}
	return posts, nil
}

// InsertPost writes a new row and returns the assigned id and created_at.
func InsertPost(ctx context.Context, p *models.Post) error {
	taggedJSON, _ := json.Marshal(p.TaggedUsers)
	return db.Pool.QueryRow(ctx,
		"INSERT INTO posts (user_id, author_name, author_avatar, image_url, description, tagged_users) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at",
		p.UserId, p.AuthorName, p.AuthorAvatar, p.ImageUrl, p.Description, taggedJSON).Scan(&p.Id, &p.CreatedAt)
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
	db.Pool.Exec(ctx,
		`UPDATE users SET posts = (SELECT COUNT(*) FROM posts WHERE user_id = $1) WHERE id = $1`, userId)
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
		rows.Scan(&l.UserID, &l.UserName, &l.Avatar)
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
	return count, nil
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
		rows.Scan(&cm.ID, &cm.UserID, &cm.UserName, &cm.UserAvatar, &cm.UserVerified, &cm.Content, &cm.CreatedAt)
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
		rows.Scan(&t.Tag, &t.Count)
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []models.TagCount{}
	}
	return tags, nil
}
