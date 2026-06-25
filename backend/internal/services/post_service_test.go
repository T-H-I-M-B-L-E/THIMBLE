package services

import (
	"context"
	"testing"

	"chat-app/internal/models"
)

// ── CreatePost validation (all cases return before hitting the DB) ────────────

func TestCreatePost_EmptyPost(t *testing.T) {
	p := &models.Post{Description: "", ImageUrl: "", Images: nil}
	err := CreatePost(context.TODO(), "user-1", p)
	requireCode(t, err, 400, "empty_post")
}

func TestCreatePost_WhitespaceOnlyDescription(t *testing.T) {
	p := &models.Post{Description: "   ", ImageUrl: "", Images: nil}
	err := CreatePost(context.TODO(), "user-1", p)
	requireCode(t, err, 400, "empty_post")
}

func TestCreatePost_TooManyImages(t *testing.T) {
	images := []string{"a", "b", "c", "d", "e", "f", "g"} // 7 distinct > cap of 6
	p := &models.Post{Images: images}
	err := CreatePost(context.TODO(), "user-1", p)
	requireCode(t, err, 400, "too_many_images")
}

// ── Dedup side-effects (verified during the too_many_images rejection path) ───

func TestCreatePost_DeduplicatesBeforeCapCheck(t *testing.T) {
	// 13 entries but only 7 unique — after dedup the count is 7, which still
	// exceeds the cap, so too_many_images fires. We verify the dedup happened
	// by checking p.Images was reduced from 13 to 7 before the cap check.
	images := []string{"a", "b", "c", "d", "e", "f", "g",
		"a", "b", "c", "d", "e", "f"}
	p := &models.Post{Images: images}
	err := CreatePost(context.TODO(), "user-1", p)
	requireCode(t, err, 400, "too_many_images")
	if len(p.Images) != 7 {
		t.Errorf("expected 7 deduplicated images before cap check, got %d", len(p.Images))
	}
}

func TestCreatePost_DropsEmptyImageURLs(t *testing.T) {
	// Blanks stripped + 7 distinct real URLs → still over cap → too_many_images.
	// Verifies blank-stripping happened before the cap check.
	images := []string{"a", "", "b", "c", "d", "e", "f", "g", "  "}
	p := &models.Post{Images: images}
	err := CreatePost(context.TODO(), "user-1", p)
	requireCode(t, err, 400, "too_many_images")
	if len(p.Images) != 7 {
		t.Errorf("expected 7 images after blank stripping, got %d", len(p.Images))
	}
}
