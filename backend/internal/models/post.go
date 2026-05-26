package models

import "time"

type Post struct {
	Id             int       `json:"id"`
	Slug           string    `json:"slug"`
	UserId         string    `json:"userId"`
	AuthorName     string    `json:"authorName"`
	AuthorAvatar   string    `json:"authorAvatar"`
	AuthorVerified bool      `json:"authorVerified"`
	ImageUrl       string    `json:"imageUrl"`
	Images         []string  `json:"images"`
	Description    string    `json:"description"`
	Likes          int       `json:"likes"`
	CommentCount   int       `json:"commentCount"`
	LikedByMe      bool      `json:"likedByMe"`
	SavedByMe      bool      `json:"savedByMe"`
	TaggedUsers    []string  `json:"taggedUsers"`
	CreatedAt      time.Time `json:"createdAt"`
}

type Comment struct {
	ID           int64     `json:"id"`
	UserID       string    `json:"userId"`
	UserName     string    `json:"userName"`
	UserAvatar   string    `json:"userAvatar"`
	UserVerified bool      `json:"userVerified"`
	Content      string    `json:"content"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Liker struct {
	UserID   string `json:"userId"`
	UserName string `json:"userName"`
	Avatar   string `json:"avatar"`
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}
