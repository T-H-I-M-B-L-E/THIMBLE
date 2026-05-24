package services

import (
	"context"
	"strings"

	"chat-app/internal/models"
	"chat-app/internal/repositories"
)

const feedPageSize = 20

func ListPosts(ctx context.Context, callerID, beforeID, filterUserID string) ([]models.Post, *ServiceError) {
	posts, err := repositories.ListPosts(ctx, callerID, beforeID, filterUserID, feedPageSize)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch posts")
	}
	return posts, nil
}

func GetPost(ctx context.Context, callerID, postID string) (*models.Post, *ServiceError) {
	post, err := repositories.GetPostByID(ctx, callerID, postID)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch post")
	}
	if post == nil {
		return nil, NewError(404, "not_found", "post not found")
	}
	return post, nil
}

// MaxImagesPerPost caps multi-image posts. Keep small enough to feel
// curated and to bound feed media bytes.
const MaxImagesPerPost = 6

func CreatePost(ctx context.Context, userId string, p *models.Post) *ServiceError {
	// Normalize images: drop empties, dedupe trailing slashes, enforce cap.
	clean := make([]string, 0, len(p.Images))
	seen := map[string]bool{}
	for _, u := range p.Images {
		u = strings.TrimSpace(u)
		if u == "" || seen[u] {
			continue
		}
		seen[u] = true
		clean = append(clean, u)
	}
	p.Images = clean
	if len(p.Images) > MaxImagesPerPost {
		return NewError(400, "too_many_images", "a post can contain at most 6 images")
	}

	hasImage := strings.TrimSpace(p.ImageUrl) != "" || len(p.Images) > 0
	hasText := strings.TrimSpace(p.Description) != ""
	if !hasImage && !hasText {
		return NewError(400, "empty_post", "post must include an image or a caption")
	}

	p.UserId = userId
	if p.TaggedUsers == nil {
		p.TaggedUsers = []string{}
	}

	if err := repositories.InsertPost(ctx, p); err != nil {
		return NewError(500, "db_failed", "failed to create post")
	}
	repositories.RefreshUserPostCount(ctx, userId)
	return nil
}

func DeletePost(ctx context.Context, userId, postId string) *ServiceError {
	rows, err := repositories.DeletePost(ctx, postId, userId)
	if err != nil {
		return NewError(500, "db_failed", "failed to delete post")
	}
	if rows == 0 {
		return NewError(404, "not_found", "post not found")
	}
	repositories.RefreshUserPostCount(ctx, userId)
	return nil
}

func ListPostLikers(ctx context.Context, postId string) ([]models.Liker, *ServiceError) {
	likers, err := repositories.ListPostLikers(ctx, postId)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch likes")
	}
	return likers, nil
}

func SetPostLike(ctx context.Context, userId, postId string, liked bool) (int, *ServiceError) {
	count, err := repositories.SetLike(ctx, postId, userId, liked)
	if err != nil {
		if liked {
			return 0, NewError(500, "db_failed", "failed to like post")
		}
		return 0, NewError(500, "db_failed", "failed to unlike post")
	}
	return count, nil
}

func ListPostComments(ctx context.Context, postId string) ([]models.Comment, *ServiceError) {
	comments, err := repositories.ListPostComments(ctx, postId)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch comments")
	}
	return comments, nil
}

func CreatePostComment(ctx context.Context, userId, postId, content string) (*models.Comment, *ServiceError) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, NewError(400, "missing_content", "content is required")
	}

	userName, userAvatar := repositories.GetUserNameAndAvatar(ctx, userId)
	verified := repositories.IsUserVerified(ctx, userId)

	cm, err := repositories.InsertComment(ctx, postId, userId, userName, userAvatar, content)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to post comment")
	}
	cm.UserVerified = verified
	return &cm, nil
}

func TrendingTags(ctx context.Context) ([]models.TagCount, *ServiceError) {
	tags, err := repositories.TrendingTags(ctx)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch tags")
	}
	return tags, nil
}

func DeletePostComment(ctx context.Context, userID, postID, commentID string) *ServiceError {
	ownerID, err := repositories.GetCommentOwner(ctx, commentID)
	if err != nil {
		return NewError(404, "not_found", "comment not found")
	}
	if ownerID != userID {
		return NewError(403, "forbidden", "you can only delete your own comments")
	}
	if err := repositories.DeleteComment(ctx, commentID); err != nil {
		return NewError(500, "db_failed", "failed to delete comment")
	}
	return nil
}

func SetPostSave(ctx context.Context, userID, postID string, save bool) *ServiceError {
	if err := repositories.SetPostSave(ctx, userID, postID, save); err != nil {
		return NewError(500, "db_failed", "failed to update save")
	}
	return nil
}

func IsPostSaved(ctx context.Context, userID, postID string) (bool, *ServiceError) {
	saved, err := repositories.IsPostSaved(ctx, userID, postID)
	if err != nil {
		return false, NewError(500, "db_failed", "failed to check save status")
	}
	return saved, nil
}

func ListSavedPosts(ctx context.Context, userID string) ([]models.Post, *ServiceError) {
	posts, err := repositories.ListSavedPosts(ctx, userID)
	if err != nil {
		return nil, NewError(500, "db_failed", "failed to fetch saved posts")
	}
	return posts, nil
}
