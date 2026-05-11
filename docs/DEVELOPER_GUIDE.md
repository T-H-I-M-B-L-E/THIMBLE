# T H I M B L E — Developer Guide
**Full Implementation Roadmap**

Prepared by: Adegbola Anjolaoluwa, Full Stack Developer  
Last Updated: May 2026  
Status: Living document — update as items are completed

---

## How to Use This Guide

This document is the single source of truth for everything that needs to be built, fixed, or removed. Work through it **in phase order**. Every item has:

- What is broken / missing
- Exactly what to build
- Which files to change
- The database changes needed

Do not skip phases. Phase 1 must be done before Phase 2.

---

## Quick Audit Summary

| Category | Count | Status |
|---|---|---|
| Pages 100% hardcoded | 1 (`/explore`) | Must fix |
| Pages with mock fallback | 3 (dashboard, feed, gigs) | Must fix |
| Non-functional buttons | 14+ | Must fix |
| Social features with no API | 4 (likes, comments, follows, saves) | Must build |
| Mock data arrays to delete | 3 (`mockGigs`, `mockDesignPosts`, explore array) | Must delete |
| Hardcoded stats | 7 (right-rail, sidebar, profile) | Must wire up |
| Missing backend routes | 8 | Must build |

---

## PHASE 1 — Database & Backend First
*Do this before touching the frontend. Everything depends on it.*

---

### 1.1 Add Missing Tables

Add these to `backend/main.go` in the `initDB()` function alongside the existing `CREATE TABLE IF NOT EXISTS` blocks.

#### Likes table
```sql
CREATE TABLE IF NOT EXISTS post_likes (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
```

#### Comments table
```sql
CREATE TABLE IF NOT EXISTS post_comments (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL DEFAULT '',
    user_avatar TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
```

#### Follows table
```sql
CREATE TABLE IF NOT EXISTS follows (
    id          BIGSERIAL PRIMARY KEY,
    follower_id TEXT NOT NULL,
    followed_id TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
```

#### Saved posts table
```sql
CREATE TABLE IF NOT EXISTS saved_posts (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);
```

#### Gig applications table
```sql
CREATE TABLE IF NOT EXISTS gig_applications (
    id         BIGSERIAL PRIMARY KEY,
    gig_id     BIGINT NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(gig_id, user_id)
);
```

---

### 1.2 Add Missing Backend Routes

Add these routes to `backend/main.go`.

#### Likes

```go
// POST /api/posts/:id/like  — toggle like
app.Post("/api/posts/:id/like", jwtAuth, func(c *fiber.Ctx) error {
    postID, _ := strconv.Atoi(c.Params("id"))
    userID, _ := c.Locals("userId").(string)
    ctx := context.Background()

    var count int
    dbPool.QueryRow(ctx,
        "SELECT COUNT(*) FROM post_likes WHERE post_id = $1 AND user_id = $2",
        postID, userID).Scan(&count)

    if count > 0 {
        dbPool.Exec(ctx, "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", postID, userID)
        dbPool.Exec(ctx, "UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1", postID)
        return c.JSON(fiber.Map{"liked": false})
    }

    dbPool.Exec(ctx, "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", postID, userID)
    dbPool.Exec(ctx, "UPDATE posts SET likes = likes + 1 WHERE id = $1", postID)
    return c.JSON(fiber.Map{"liked": true})
})

// GET /api/posts/liked  — which posts has the current user liked
app.Get("/api/posts/liked", jwtAuth, func(c *fiber.Ctx) error {
    userID, _ := c.Locals("userId").(string)
    rows, err := dbPool.Query(context.Background(),
        "SELECT post_id FROM post_likes WHERE user_id = $1", userID)
    if err != nil {
        return c.JSON([]int{})
    }
    defer rows.Close()
    var ids []int
    for rows.Next() {
        var id int
        rows.Scan(&id)
        ids = append(ids, id)
    }
    if ids == nil {
        ids = []int{}
    }
    return c.JSON(ids)
})
```

#### Comments

```go
// GET /api/posts/:id/comments
app.Get("/api/posts/:id/comments", jwtAuth, func(c *fiber.Ctx) error {
    postID, _ := strconv.Atoi(c.Params("id"))
    rows, err := dbPool.Query(context.Background(),
        `SELECT id, post_id, user_id, user_name, user_avatar, content, created_at
         FROM post_comments WHERE post_id = $1
         ORDER BY created_at ASC LIMIT 100`, postID)
    if err != nil {
        return c.JSON([]fiber.Map{})
    }
    defer rows.Close()
    var comments []fiber.Map
    for rows.Next() {
        var id, postId int
        var userId, userName, userAvatar, content, createdAt string
        rows.Scan(&id, &postId, &userId, &userName, &userAvatar, &content, &createdAt)
        comments = append(comments, fiber.Map{
            "id": id, "postId": postId, "userId": userId,
            "userName": userName, "userAvatar": userAvatar,
            "content": content, "createdAt": createdAt,
        })
    }
    if comments == nil {
        comments = []fiber.Map{}
    }
    return c.JSON(comments)
})

// POST /api/posts/:id/comments
app.Post("/api/posts/:id/comments", jwtAuth, func(c *fiber.Ctx) error {
    postID, _ := strconv.Atoi(c.Params("id"))
    userID, _ := c.Locals("userId").(string)
    ctx := context.Background()

    var body struct {
        Content string `json:"content"`
    }
    c.BodyParser(&body)
    if strings.TrimSpace(body.Content) == "" {
        return c.Status(400).JSON(fiber.Map{"error": "content required"})
    }

    // Get author info
    var userName, userAvatar string
    dbPool.QueryRow(ctx, "SELECT full_name, COALESCE(avatar_url,'') FROM users WHERE id = $1", userID).
        Scan(&userName, &userAvatar)

    var newID int
    dbPool.QueryRow(ctx,
        `INSERT INTO post_comments (post_id, user_id, user_name, user_avatar, content)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        postID, userID, userName, userAvatar, body.Content).Scan(&newID)

    dbPool.Exec(ctx, "UPDATE posts SET comments = comments + 1 WHERE id = $1", postID)

    return c.JSON(fiber.Map{
        "id": newID, "postId": postID, "userId": userID,
        "userName": userName, "userAvatar": userAvatar, "content": body.Content,
    })
})

// DELETE /api/posts/:postId/comments/:commentId
app.Delete("/api/posts/:postId/comments/:commentId", jwtAuth, func(c *fiber.Ctx) error {
    commentID, _ := strconv.Atoi(c.Params("commentId"))
    postID, _ := strconv.Atoi(c.Params("postId"))
    userID, _ := c.Locals("userId").(string)
    ctx := context.Background()

    result, err := dbPool.Exec(ctx,
        "DELETE FROM post_comments WHERE id = $1 AND user_id = $2", commentID, userID)
    if err != nil || result.RowsAffected() == 0 {
        return c.Status(403).JSON(fiber.Map{"error": "not allowed"})
    }
    dbPool.Exec(ctx, "UPDATE posts SET comments = GREATEST(comments - 1, 0) WHERE id = $1", postID)
    return c.JSON(fiber.Map{"success": true})
})
```

#### Add `comments` column to posts table (if not already there)
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments INT DEFAULT 0;
```

#### Follows

```go
// POST /api/users/:id/follow  — toggle follow
app.Post("/api/users/:id/follow", jwtAuth, func(c *fiber.Ctx) error {
    followedID := c.Params("id")
    followerID, _ := c.Locals("userId").(string)
    if followerID == followedID {
        return c.Status(400).JSON(fiber.Map{"error": "cannot follow yourself"})
    }
    ctx := context.Background()

    var count int
    dbPool.QueryRow(ctx,
        "SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND followed_id = $2",
        followerID, followedID).Scan(&count)

    if count > 0 {
        dbPool.Exec(ctx, "DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2", followerID, followedID)
        dbPool.Exec(ctx, "UPDATE users SET followers = GREATEST(followers - 1, 0) WHERE id = $1", followedID)
        dbPool.Exec(ctx, "UPDATE users SET following = GREATEST(following - 1, 0) WHERE id = $1", followerID)
        return c.JSON(fiber.Map{"following": false})
    }

    dbPool.Exec(ctx, "INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2)", followerID, followedID)
    dbPool.Exec(ctx, "UPDATE users SET followers = followers + 1 WHERE id = $1", followedID)
    dbPool.Exec(ctx, "UPDATE users SET following = following + 1 WHERE id = $1", followerID)
    return c.JSON(fiber.Map{"following": true})
})

// GET /api/users/:id/followers
app.Get("/api/users/:id/followers", jwtAuth, func(c *fiber.Ctx) error {
    userID := c.Params("id")
    rows, _ := dbPool.Query(context.Background(),
        `SELECT u.id, u.full_name, u.avatar_url, u.role
         FROM follows f JOIN users u ON u.id = f.follower_id
         WHERE f.followed_id = $1 LIMIT 50`, userID)
    defer rows.Close()
    var users []fiber.Map
    for rows.Next() {
        var id, name, avatar, role string
        rows.Scan(&id, &name, &avatar, &role)
        users = append(users, fiber.Map{"id": id, "name": name, "avatar": avatar, "role": role})
    }
    if users == nil { users = []fiber.Map{} }
    return c.JSON(users)
})

// GET /api/users/:id/following
app.Get("/api/users/:id/following", jwtAuth, func(c *fiber.Ctx) error {
    userID := c.Params("id")
    rows, _ := dbPool.Query(context.Background(),
        `SELECT u.id, u.full_name, u.avatar_url, u.role
         FROM follows f JOIN users u ON u.id = f.followed_id
         WHERE f.follower_id = $1 LIMIT 50`, userID)
    defer rows.Close()
    var users []fiber.Map
    for rows.Next() {
        var id, name, avatar, role string
        rows.Scan(&id, &name, &avatar, &role)
        users = append(users, fiber.Map{"id": id, "name": name, "avatar": avatar, "role": role})
    }
    if users == nil { users = []fiber.Map{} }
    return c.JSON(users)
})
```

#### Save Posts

```go
// POST /api/posts/:id/save  — toggle save
app.Post("/api/posts/:id/save", jwtAuth, func(c *fiber.Ctx) error {
    postID, _ := strconv.Atoi(c.Params("id"))
    userID, _ := c.Locals("userId").(string)
    ctx := context.Background()

    var count int
    dbPool.QueryRow(ctx,
        "SELECT COUNT(*) FROM saved_posts WHERE post_id = $1 AND user_id = $2",
        postID, userID).Scan(&count)

    if count > 0 {
        dbPool.Exec(ctx, "DELETE FROM saved_posts WHERE post_id = $1 AND user_id = $2", postID, userID)
        return c.JSON(fiber.Map{"saved": false})
    }
    dbPool.Exec(ctx, "INSERT INTO saved_posts (post_id, user_id) VALUES ($1, $2)", postID, userID)
    return c.JSON(fiber.Map{"saved": true})
})

// GET /api/posts/saved  — current user's saved posts
app.Get("/api/posts/saved", jwtAuth, func(c *fiber.Ctx) error {
    userID, _ := c.Locals("userId").(string)
    rows, _ := dbPool.Query(context.Background(),
        `SELECT p.* FROM posts p
         JOIN saved_posts sp ON sp.post_id = p.id
         WHERE sp.user_id = $1
         ORDER BY sp.created_at DESC LIMIT 50`, userID)
    defer rows.Close()
    // scan posts as normal...
    return c.JSON(rows)
})
```

#### Gig Applications

```go
// POST /api/gigs/:id/apply  — toggle application
app.Post("/api/gigs/:id/apply", jwtAuth, func(c *fiber.Ctx) error {
    gigID, _ := strconv.Atoi(c.Params("id"))
    userID, _ := c.Locals("userId").(string)
    ctx := context.Background()

    var count int
    dbPool.QueryRow(ctx,
        "SELECT COUNT(*) FROM gig_applications WHERE gig_id = $1 AND user_id = $2",
        gigID, userID).Scan(&count)

    if count > 0 {
        dbPool.Exec(ctx, "DELETE FROM gig_applications WHERE gig_id = $1 AND user_id = $2", gigID, userID)
        dbPool.Exec(ctx, "UPDATE gigs SET applications = GREATEST(applications - 1, 0) WHERE id = $1", gigID)
        return c.JSON(fiber.Map{"applied": false})
    }
    dbPool.Exec(ctx, "INSERT INTO gig_applications (gig_id, user_id) VALUES ($1, $2)", gigID, userID)
    dbPool.Exec(ctx, "UPDATE gigs SET applications = applications + 1 WHERE id = $1", gigID)
    return c.JSON(fiber.Map{"applied": true})
})
```

#### Smart Feed (Engagement-Based Algorithm)

Update the existing `GET /api/posts` handler:

```go
app.Get("/api/posts", jwtAuth, func(c *fiber.Ctx) error {
    userID, _ := c.Locals("userId").(string)
    ctx := context.Background()
    mode := c.Query("mode", "smart") // "smart" or "latest" or "following"

    var query string
    switch mode {
    case "following":
        // Only show posts from people you follow
        query = `
            SELECT p.*, 
                   EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as liked_by_me,
                   EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as saved_by_me
            FROM posts p
            JOIN follows f ON f.followed_id = p.user_id
            WHERE f.follower_id = $1
              AND p.created_at > NOW() - INTERVAL '30 days'
            ORDER BY (p.likes + p.comments * 2) DESC, p.created_at DESC
            LIMIT 50`
    case "latest":
        query = `
            SELECT p.*,
                   EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as liked_by_me,
                   EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as saved_by_me
            FROM posts p
            ORDER BY p.created_at DESC
            LIMIT 50`
    default: // "smart"
        query = `
            SELECT p.*,
                   EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as liked_by_me,
                   EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as saved_by_me
            FROM posts p
            WHERE p.created_at > NOW() - INTERVAL '7 days'
            ORDER BY (p.likes + p.comments * 2) DESC, p.created_at DESC
            LIMIT 50`
    }
    // run query with $1 = userID, scan results...
})
```

#### Real Explore Endpoint

```go
// GET /api/explore  — discovery feed (no auth required)
app.Get("/api/explore", func(c *fiber.Ctx) error {
    rows, _ := dbPool.Query(context.Background(),
        `SELECT p.*, u.role as author_role
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.created_at > NOW() - INTERVAL '30 days'
         ORDER BY (p.likes + p.comments * 2) DESC, p.created_at DESC
         LIMIT 30`)
    // scan and return...
})
```

#### User Profile Public View

```go
// GET /api/users/:id/posts  — public posts by a user
app.Get("/api/users/:id/posts", jwtAuth, func(c *fiber.Ctx) error {
    targetUserID := c.Params("id")
    viewerID, _ := c.Locals("userId").(string)
    rows, _ := dbPool.Query(context.Background(),
        `SELECT p.*,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $2) as liked_by_me
         FROM posts p
         WHERE p.user_id = $1
         ORDER BY p.created_at DESC LIMIT 50`, targetUserID, viewerID)
    // scan and return...
})
```

---

## PHASE 2 — Frontend: Remove All Static Data
*Do after Phase 1 backend is deployed and tested.*

---

### 2.1 Delete Mock Data from `lib/store.ts`

**File**: `lib/store.ts`

**Remove**:
- `mockGigs` array (lines ~93–184) — all 6 hardcoded gigs
- `mockDesignPosts` array (lines ~186–265) — all 6 hardcoded posts
- The local-only `signup()`, `login()`, `postGig()`, `applyToGig()`, `likePost()`, `addDesignPost()` functions that manipulate client state only

**Keep**:
- Zustand store structure
- `user` state
- `setUser`, `logout`, `updateProfile` actions

After removal, the store should only manage user session state — not content data.

---

### 2.2 Fix the Explore Page

**File**: `app/explore/page.tsx`

**Remove**:
- The hardcoded `explorePosts` array
- The hardcoded `categories` array
- The local filter logic that filters the fake array

**Replace with**:
```typescript
const [posts, setPosts] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch("/api/explore")
    .then(r => r.json())
    .then(data => setPosts(Array.isArray(data) ? data : []))
    .finally(() => setLoading(false))
}, [])
```

---

### 2.3 Fix the Dashboard Home

**File**: `app/dashboard/[role]/page.tsx`

**Remove**:
- `designPosts` from store usage in the portfolio grid
- `gigs` from store usage in the gigs section

**Replace with**:
```typescript
const [recentPosts, setRecentPosts] = useState([])
const [recentGigs, setRecentGigs] = useState([])

useEffect(() => {
  fetch("/api/posts?mode=latest&limit=6", { credentials: "include" })
    .then(r => r.json()).then(setRecentPosts)
  fetch("/api/gigs?limit=3", { credentials: "include" })
    .then(r => r.json()).then(setRecentGigs)
}, [])
```

---

### 2.4 Fix the Right Rail

**File**: `components/right-rail.tsx`

**Remove**:
- Hardcoded stats: "12 profile views", "3 new followers", "2 gig replies"
- Hardcoded "People you might know" section (Atelier Nord, Yusuf Demir, Studio Calma)
- Hardcoded trending tags (#natural-dye, #small-batch, etc.)

**Replace with** — a real "Suggested Users" endpoint:

**Backend** (add to `main.go`):
```go
// GET /api/users/suggested
app.Get("/api/users/suggested", jwtAuth, func(c *fiber.Ctx) error {
    userID, _ := c.Locals("userId").(string)
    rows, _ := dbPool.Query(context.Background(),
        `SELECT id, full_name, avatar_url, role
         FROM users
         WHERE id != $1
           AND id NOT IN (
               SELECT followed_id FROM follows WHERE follower_id = $1
           )
         ORDER BY created_at DESC LIMIT 5`, userID)
    // scan and return...
})
```

**Frontend** (right-rail.tsx):
```typescript
const [suggested, setSuggested] = useState([])
useEffect(() => {
  fetch("/api/users/suggested", { credentials: "include" })
    .then(r => r.json()).then(setSuggested)
}, [])
```

For the stats (profile views, etc.) — **skip for now** (need view tracking which is a bigger feature). Replace with a static "Welcome to T H I M B L E" message until tracking is built.

---

### 2.5 Fix the Sidebar

**File**: `components/sidebar.tsx`

**Remove**:
- Hardcoded trending topics (#MinimalDesign, etc.)
- Hardcoded suggested accounts (Harper & Stone Studio, etc.)

**Replace with**:
```typescript
// Pull from /api/users/suggested for suggested accounts
// For trending tags: skip for now — remove section entirely
// Trending requires a tags system which is Phase 4
```

---

### 2.6 Wire Up the Like Button

**File**: `components/post-card.tsx`

**Remove**:
```typescript
// This is all client-side — remove it:
const [isLiked, setIsLiked] = useState(false)
const handleLike = () => setIsLiked(!isLiked)
```

**Replace with**:
```typescript
const [liked, setLiked] = useState(post.likedByMe ?? false)
const [likeCount, setLikeCount] = useState(post.likes ?? 0)
const [loading, setLoading] = useState(false)

const handleLike = async () => {
  if (loading) return
  setLoading(true)
  // Optimistic update
  setLiked(!liked)
  setLikeCount(liked ? likeCount - 1 : likeCount + 1)

  try {
    const res = await fetch(`/api/posts/${post.id}/like`, {
      method: "POST",
      credentials: "include",
    })
    const data = await res.json()
    setLiked(data.liked)
  } catch {
    // Rollback on error
    setLiked(liked)
    setLikeCount(likeCount)
  } finally {
    setLoading(false)
  }
}
```

---

### 2.7 Wire Up the Save Button

Same pattern as likes but calls `/api/posts/:id/save`.

**File**: `components/post-card.tsx`

```typescript
const handleSave = async () => {
  const res = await fetch(`/api/posts/${post.id}/save`, {
    method: "POST",
    credentials: "include",
  })
  const data = await res.json()
  setIsSaved(data.saved)
}
```

---

### 2.8 Build the Comments Section

**New file**: `components/comments-panel.tsx`

```typescript
export function CommentsPanel({ postId, onClose }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState("")

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`, { credentials: "include" })
      .then(r => r.json()).then(setComments)
  }, [postId])

  const submit = async () => {
    if (!text.trim()) return
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    })
    const newComment = await res.json()
    setComments([...comments, newComment])
    setText("")
  }

  return (
    <div>
      {comments.map(c => (
        <div key={c.id}>
          <img src={c.userAvatar} />
          <strong>{c.userName}</strong>
          <p>{c.content}</p>
        </div>
      ))}
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={submit}>Post</button>
    </div>
  )
}
```

Wire the comment icon in `components/post-card.tsx` to toggle this panel.

---

### 2.9 Build the Follow Button

**New component**: `components/follow-button.tsx`

```typescript
export function FollowButton({ userId }: { userId: string }) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  // On mount, check if already following
  useEffect(() => {
    // Could check against a list of following IDs fetched once at app level
  }, [userId])

  const toggle = async () => {
    if (loading) return
    setLoading(true)
    const res = await fetch(`/api/users/${userId}/follow`, {
      method: "POST",
      credentials: "include",
    })
    const data = await res.json()
    setFollowing(data.following)
    setLoading(false)
  }

  return (
    <button onClick={toggle} disabled={loading}>
      {following ? "Following" : "Follow"}
    </button>
  )
}
```

Replace all hardcoded follow buttons in `components/right-rail.tsx`, `components/sidebar.tsx`, and any profile pages with `<FollowButton userId={user.id} />`.

---

### 2.10 Fix Profile Followers/Following Count

**File**: `app/dashboard/[role]/profile/page.tsx`

**Remove**:
```typescript
// Hardcoded:
<span>0</span> Followers
<span>0</span> Following
```

**Replace with**:
```typescript
// user comes from useAuth() and already has the counts
<span>{user.followers}</span> Followers
<span>{user.following}</span> Following
```

The `users` table already has `followers` and `following` columns. They're updated by the follow/unfollow routes you built in Phase 1. The `useAuth()` hook fetches `/api/auth/me` which returns the full user object including those counts.

---

### 2.11 Fix Gig Apply Button

**File**: `app/dashboard/[role]/gigs/page.tsx`

**Remove**:
```typescript
// Local only:
const applyToGig = useStore(state => state.applyToGig)
applyToGig(gig.id)
```

**Replace with**:
```typescript
const handleApply = async (gigId: number) => {
  const res = await fetch(`/api/gigs/${gigId}/apply`, {
    method: "POST",
    credentials: "include",
  })
  const data = await res.json()
  // Update local state to reflect applied status
}
```

---

### 2.12 Fix the Post Composer

**File**: `components/feed-view.tsx`

The composer bar ("What are you working on?") currently has `onClick={() => {}}`.

**Replace with**:
```typescript
// The "Photo" button should open <CreatePostModal />
// The "Gig" button should open a new <CreateGigModal />
// The "Ask" button — skip for now (future feature)

const [showCreatePost, setShowCreatePost] = useState(false)
const [showCreateGig, setShowCreateGig] = useState(false)

// onClick for Photo button:
onClick={() => setShowCreatePost(true)}

// onClick for Gig button:
onClick={() => setShowCreateGig(true)}
```

The `<CreatePostModal>` already exists. Wire it up here instead of leaving the button empty.

---

### 2.13 Fix Feed Mode Toggle

**File**: `app/dashboard/[role]/feed/page.tsx`

Add a tab/toggle so users can switch between:
- **For You** (`?mode=smart`) — engagement-ranked last 7 days
- **Following** (`?mode=following`) — posts from people you follow
- **Latest** (`?mode=latest`) — pure chronological

```typescript
const [mode, setMode] = useState<"smart" | "following" | "latest">("smart")

// Pass mode to the API call:
fetch(`/api/posts?mode=${mode}`, { credentials: "include" })
```

---

## PHASE 3 — New Features
*Build after Phase 2 is done and the app is clean.*

---

### 3.1 User Profile Pages (Public)

Right now there are no public profile pages. If you click someone's name in a post, nothing happens.

**What to build**:
- Route: `/profile/[userId]`
- Shows: avatar, name, role, bio, followers/following, all their posts
- Has: Follow button, Message button

**Files to create**:
- `app/profile/[userId]/page.tsx`

**API already available**:
- `GET /users/:id` — profile data
- `GET /api/users/:id/posts` — their posts (build in Phase 1)
- `POST /api/users/:id/follow` — follow toggle (build in Phase 1)

---

### 3.2 Notifications

**What users need to be notified about**:
- Someone followed them
- Someone liked their post
- Someone commented on their post

**New database table**:
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id           BIGSERIAL PRIMARY KEY,
    user_id      TEXT NOT NULL,           -- who receives the notification
    actor_id     TEXT NOT NULL,           -- who triggered it
    actor_name   TEXT NOT NULL,
    actor_avatar TEXT NOT NULL DEFAULT '',
    type         TEXT NOT NULL,           -- 'follow', 'like', 'comment'
    post_id      BIGINT,
    message      TEXT NOT NULL,
    read         BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
```

**New backend routes**:
```
GET  /api/notifications        — get current user's notifications
POST /api/notifications/read   — mark all as read
```

**Trigger notifications** inside the like, comment, and follow handlers:
```go
// After a successful follow:
dbPool.Exec(ctx,
    `INSERT INTO notifications (user_id, actor_id, actor_name, actor_avatar, type, message)
     VALUES ($1, $2, $3, $4, 'follow', $5)`,
    followedID, followerID, followerName, followerAvatar,
    followerName+" started following you")
```

**Frontend**:
- Bell icon in sidebar/nav
- Badge count = unread notifications
- Dropdown showing notification list

---

### 3.3 Blob Storage for Images (AWS S3)

**Why now**: With posts, profile photos, and gig images, storage will grow fast.

**What to do**:

**Step 1** — Create an S3 bucket on AWS (free tier: 5 GB / month)

**Step 2** — Add Go S3 dependency:
```bash
cd backend
go get github.com/aws/aws-sdk-go-v2/config
go get github.com/aws/aws-sdk-go-v2/service/s3
```

**Step 3** — Add upload helper to `backend/main.go`:
```go
func uploadToS3(filename string, reader io.Reader, contentType string) (string, error) {
    cfg, _ := awsConfig.LoadDefaultConfig(context.Background(),
        awsConfig.WithRegion(os.Getenv("AWS_REGION")))
    client := s3.NewFromConfig(cfg)

    key := fmt.Sprintf("uploads/%d-%s", time.Now().UnixNano(), filename)
    _, err := client.PutObject(context.Background(), &s3.PutObjectInput{
        Bucket:      aws.String(os.Getenv("S3_BUCKET")),
        Key:         aws.String(key),
        Body:        reader,
        ContentType: aws.String(contentType),
    })
    if err != nil { return "", err }
    return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", os.Getenv("S3_BUCKET"), key), nil
}
```

**Step 4** — New upload endpoint:
```go
app.Post("/api/upload", jwtAuth, func(c *fiber.Ctx) error {
    file, err := c.FormFile("file")
    if err != nil { return c.Status(400).JSON(fiber.Map{"error": "no file"}) }
    if file.Size > 10*1024*1024 { // 10 MB
        return c.Status(400).JSON(fiber.Map{"error": "file too large"})
    }
    f, _ := file.Open()
    defer f.Close()
    url, err := uploadToS3(file.Filename, f, file.Header.Get("Content-Type"))
    if err != nil { return c.Status(500).JSON(fiber.Map{"error": "upload failed"}) }
    return c.JSON(fiber.Map{"url": url})
})
```

**Step 5** — Update `lib/upload.ts` to call `/api/upload` instead of wherever it currently goes.

**New env vars needed**:
```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-west-1
S3_BUCKET=thimble-uploads
```

---

### 3.4 Rate Limiting (Security)

Add to `backend/main.go` before any routes. Cheapest approach — in-memory rate limiter, no Redis needed:

```go
import "golang.org/x/time/rate"
import "sync"

var (
    ipLimiters sync.Map // map[string]*rate.Limiter
)

func getIPLimiter(ip string) *rate.Limiter {
    v, _ := ipLimiters.LoadOrStore(ip, rate.NewLimiter(rate.Every(time.Minute), 10))
    return v.(*rate.Limiter)
}

func rateLimitMiddleware(c *fiber.Ctx) error {
    limiter := getIPLimiter(c.IP())
    if !limiter.Allow() {
        return c.Status(429).JSON(fiber.Map{"error": "too many requests"})
    }
    return c.Next()
}

// Apply only to auth routes:
app.Post("/auth/login", rateLimitMiddleware, handleLogin)
app.Post("/auth/signup", rateLimitMiddleware, handleSignup)
app.Post("/auth/forgot-password", rateLimitMiddleware, handleForgotPassword)
```

**Dependency**:
```bash
go get golang.org/x/time/rate
```

---

## PHASE 4 — Polish
*After the app is fully functional. Low cost, high impact.*

---

### 4.1 Post Tags / Hashtags

Right now tags like `#minimalism` are hardcoded in the UI.

**What to build**:
- `post_tags` table: `(id, post_id, tag)`
- Index on `tag` for fast search
- `GET /api/tags/trending` — top 10 tags by post count in last 7 days
- Allow users to add tags when creating a post
- Click a tag → see all posts with that tag

---

### 4.2 Search

**What to build**:
- `GET /api/search?q=&type=users|posts|gigs`
- For users: `WHERE full_name ILIKE '%query%' OR role ILIKE '%query%'`
- For posts: `WHERE description ILIKE '%query%'`
- For gigs: `WHERE title ILIKE '%query%' OR description ILIKE '%query%'`
- Frontend: unified search bar with tabs

---

### 4.3 Stories / Highlights

Not for now. Expensive to build, requires video processing, complex storage. Revisit when there is budget.

---

## What NOT to Build (No Budget)

| Feature | Why Skip |
|---|---|
| Mobile app | Expensive, 6+ months of work |
| Video uploads | S3 + transcoding costs add up fast |
| AI-powered feed | Requires ML infrastructure |
| Stories | Complex media pipeline |
| Paid jobs marketplace (escrow) | Requires Stripe + legal |
| Advanced analytics for creators | Needs event tracking pipeline |
| 2FA SMS | Costs per SMS |

Use 2FA via authenticator app (TOTP) instead of SMS when you add 2FA — it is free.

---

## Implementation Order (Priority List)

```
Week 1
  ☐ Add all missing DB tables (1.1)
  ☐ Add likes backend route (1.2)
  ☐ Add comments backend routes (1.2)
  ☐ Add follows backend routes (1.2)
  ☐ Wire up like button frontend (2.6)
  ☐ Wire up follow button frontend (2.9)

Week 2
  ☐ Fix explore page (2.2)
  ☐ Fix right rail (2.4)
  ☐ Fix sidebar (2.5)
  ☐ Delete mock data from store.ts (2.1)
  ☐ Fix dashboard home (2.3)
  ☐ Wire up comments UI (2.8)

Week 3
  ☐ Add gig application API (1.2)
  ☐ Fix gig apply button (2.11)
  ☐ Add save posts API (1.2)
  ☐ Wire up save button (2.7)
  ☐ Fix profile followers/following count (2.10)
  ☐ Fix post composer (2.12)
  ☐ Add feed mode toggle (2.13)

Week 4
  ☐ Public profile pages (3.1)
  ☐ Rate limiting on auth routes (3.4)
  ☐ Input sanitization (XSS prevention)

Month 2
  ☐ S3 blob storage (3.3)
  ☐ Notifications system (3.2)

Month 3
  ☐ Hashtags / post tags (4.1)
  ☐ Search (4.2)
```

---

## Testing Requirements

Every feature in Phase 1 and 2 must have tests before it is marked done.

| Feature | Test file |
|---|---|
| Like/unlike | `__tests__/api/posts/like.test.ts` |
| Comments | `__tests__/api/posts/comments.test.ts` |
| Follow/unfollow | `__tests__/api/users/follow.test.ts` |
| Save posts | `__tests__/api/posts/save.test.ts` |
| Gig apply | `__tests__/api/gigs/apply.test.ts` |
| Feed algorithm | `__tests__/api/posts/feed.test.ts` |

Test each with:
- Happy path (normal use)
- Unauthenticated (should return 401)
- Duplicate action (like twice should unlike)
- Self-follow (should return 400)

---

## Next.js API Proxy Routes to Add

For every new backend route, add a matching Next.js proxy route in `app/api/`:

| New Route | Proxy File |
|---|---|
| `POST /api/posts/:id/like` | `app/api/posts/[id]/like/route.ts` |
| `GET /api/posts/:id/comments` | `app/api/posts/[id]/comments/route.ts` |
| `POST /api/posts/:id/comments` | `app/api/posts/[id]/comments/route.ts` |
| `DELETE /api/posts/:postId/comments/:commentId` | `app/api/posts/[postId]/comments/[commentId]/route.ts` |
| `POST /api/users/:id/follow` | `app/api/users/[id]/follow/route.ts` |
| `GET /api/users/:id/followers` | `app/api/users/[id]/followers/route.ts` |
| `GET /api/users/:id/following` | `app/api/users/[id]/following/route.ts` |
| `POST /api/posts/:id/save` | `app/api/posts/[id]/save/route.ts` |
| `GET /api/posts/saved` | `app/api/posts/saved/route.ts` |
| `POST /api/gigs/:id/apply` | `app/api/gigs/[id]/apply/route.ts` |
| `GET /api/users/suggested` | `app/api/users/suggested/route.ts` |
| `GET /api/explore` | `app/api/explore/route.ts` |
| `POST /api/upload` | `app/api/upload/route.ts` |
| `GET /api/notifications` | `app/api/notifications/route.ts` |

Each proxy follows the same pattern as existing ones in `app/api/conversations/route.ts`.

---

## Commit Message Convention

```
feat(likes): add like/unlike toggle with DB persistence
fix(feed): remove mock fallback, always use API
feat(follows): add follow/unfollow with follower count updates
refactor(store): remove mockGigs and mockDesignPosts
```

Format: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

---

*This guide is complete when every ☐ box above is checked.*
