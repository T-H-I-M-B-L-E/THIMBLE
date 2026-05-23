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

func CreatePost(ctx context.Context, userId string, p *models.Post) *ServiceError {
	hasImage := strings.TrimSpace(p.ImageUrl) != ""
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
