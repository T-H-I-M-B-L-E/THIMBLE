"use client"

import { useAuth } from "@/lib/useAuth"
import Image from "next/image"
import { Heart, MessageSquare, Bookmark, Share2, Plus, MoreHorizontal, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { CreatePostModal } from "@/components/create-post-modal"
import { useRouter } from "next/navigation"

interface Post {
  id: number | string
  userId?: string
  authorName: string
  authorAvatar: string
  imageUrl: string
  description: string
  likes: number
  comments: number
  likedByMe?: boolean
  createdAt: string
}

interface Comment {
  id: number
  postId: number
  userId: string
  userName: string
  userAvatar: string
  content: string
  createdAt: string
}

export function FeedView() {
  const router = useRouter()
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [feedError, setFeedError] = useState("")
  const [activeFilter, setActiveFilter] = useState("For you")
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [])

  useEffect(() => {
    const handlePostCreated = () => {
      fetchPosts()
    }

    window.addEventListener("thimble:post-created", handlePostCreated)
    return () => {
      window.removeEventListener("thimble:post-created", handlePostCreated)
    }
  }, [])

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts", {
        cache: "no-store",
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch posts: ${res.status}`)
      }

      const data = await res.json()
      setFeedError("")
      setPosts(data)
    } catch (err) {
      console.error("Failed to fetch posts:", err)
      setFeedError("Could not load the live feed right now.")
      setPosts([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (postId: number | string) => {
    if (!confirm("Are you sure you want to delete this post?")) return

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (res.ok) {
        setPosts((currentPosts) => currentPosts.filter((p) => String(p.id) !== String(postId)))
      } else {
        const error = await res.json()
        alert("Failed to delete: " + (error.error || "Unknown error"))
      }
    } catch (err) {
      console.error("Failed to delete post:", err)
      alert("Network error. This action needs a live backend connection.")
    }
  }

  const handleComposerOpen = () => {
    if (!user) {
      router.push("/auth/signup")
      return
    }
    setIsCreatePostOpen(true)
  }

  const handleLike = async (postId: string | number) => {
    if (!user) {
      router.push("/auth")
      return
    }

    const key = String(postId)
    const currentPost = posts.find((post) => String(post.id) === key)
    if (!currentPost) return

    const optimisticLiked = !currentPost.likedByMe
    const optimisticLikes = currentPost.likes + (optimisticLiked ? 1 : -1)

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        String(post.id) === key
          ? { ...post, likedByMe: optimisticLiked, likes: Math.max(0, optimisticLikes) }
          : post
      )
    )

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        credentials: "include",
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle like")
      }

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          String(post.id) === key
            ? { ...post, likedByMe: data.liked, likes: data.likes }
            : post
        )
      )
    } catch (error) {
      console.error("Failed to toggle like:", error)
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          String(post.id) === key ? currentPost : post
        )
      )
    }
  }

  const loadComments = async (postId: string) => {
    setLoadingComments((state) => ({ ...state, [postId]: true }))

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch comments")
      }

      setCommentsByPost((state) => ({ ...state, [postId]: data }))
    } catch (error) {
      console.error("Failed to load comments:", error)
      setCommentsByPost((state) => ({ ...state, [postId]: [] }))
    } finally {
      setLoadingComments((state) => ({ ...state, [postId]: false }))
    }
  }

  const toggleComments = async (postId: string | number) => {
    const key = String(postId)
    const isOpen = openComments.has(key)

    if (isOpen) {
      setOpenComments((state) => {
        const next = new Set(state)
        next.delete(key)
        return next
      })
      return
    }

    setOpenComments((state) => new Set(state).add(key))
    if (!commentsByPost[key]) {
      await loadComments(key)
    }
  }

  const handleCommentSubmit = async (postId: string | number) => {
    if (!user) {
      router.push("/auth")
      return
    }

    const key = String(postId)
    const content = commentDrafts[key]?.trim()
    if (!content) return

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to add comment")
      }

      setCommentsByPost((state) => ({
        ...state,
        [key]: [...(state[key] || []), data],
      }))
      setCommentDrafts((state) => ({ ...state, [key]: "" }))
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          String(post.id) === key ? { ...post, comments: post.comments + 1 } : post
        )
      )
    } catch (error) {
      console.error("Failed to add comment:", error)
    }
  }

  const filterTabs = ["For you", "Following", "Designers", "Models", "Photographers", "Brands"]

  return (
    <div className="t-feed">
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onSuccess={fetchPosts}
        user={user}
      />

      {/* Composer Bar */}
      <div className="t-composer-bar">
        {user?.avatar ? (
          <Image
            src={user.avatar}
            alt="Me"
            width={40}
            height={40}
            className="t-avatar"
            style={{ borderRadius: "50%" }}
          />
        ) : (
          <div className="t-avatar t-avatar-ph">
            {user?.fullName?.[0] ?? "U"}
          </div>
        )}
        <button className="t-composer-input" onClick={handleComposerOpen}>
          What are you working on?
        </button>
        <div className="t-composer-actions">
          <button className="t-chip" onClick={handleComposerOpen}>
            <span className="t-chip-dot photo" />
            Photo
          </button>
          <button className="t-chip" onClick={handleComposerOpen}>
            <span className="t-chip-dot gig" />
            Gig
          </button>
          <button className="t-chip" onClick={handleComposerOpen}>
            <span className="t-chip-dot ask" />
            Ask
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="t-filterbar">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            className={`t-pill ${activeFilter === tab ? "on" : ""}`}
            onClick={() => setActiveFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
        </div>
      ) : feedError ? (
        <div className="t-empty-state">
          <p>{feedError}</p>
          <button className="t-btn-quiet" onClick={fetchPosts}>Try again</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="t-empty-state">
          <p>No live posts yet.</p>
          <button className="t-btn-quiet" onClick={handleComposerOpen}>Create the first post</button>
        </div>
      ) : (
        <div className="t-feed-stream">
          {posts.map((post) => (
            <article key={post.id} className="t-post">
              <header className="t-post-head">
                <div className="t-post-author">
                  {post.authorAvatar ? (
                    <Image
                      src={post.authorAvatar}
                      alt={post.authorName}
                      width={40}
                      height={40}
                      className="t-avatar"
                      style={{ borderRadius: "50%" }}
                    />
                  ) : (
                    <div className="t-avatar t-avatar-ph">{post.authorName?.[0] ?? "U"}</div>
                  )}
                  <div className="t-post-author-meta">
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="t-strong" style={{ fontSize: "14px" }}>{post.authorName}</span>
                      <span className="t-muted-xs">@handle</span>
                    </div>
                    <div className="t-muted-xs">{post.authorName} · {new Date(post.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {user?.id === post.userId && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    style={{ background: "none", border: 0, cursor: "pointer", color: "var(--t-ink-2)", padding: "4px" }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {!user || user?.id !== post.userId && (
                  <button style={{ background: "none", border: 0, cursor: "pointer", color: "var(--t-ink-2)", padding: "4px" }}>
                    <MoreHorizontal size={16} />
                  </button>
                )}
              </header>

              <button className="t-post-image">
                <img src={post.imageUrl} alt={post.description} />
              </button>

              <div className="t-post-body">
                <div className="t-post-actions">
                  <button
                    className={`t-action ${post.likedByMe ? "on" : ""}`}
                    onClick={() => handleLike(post.id)}
                  >
                    <Heart size={16} fill={post.likedByMe ? "currentColor" : "none"} />
                    <span>{post.likes}</span>
                  </button>
                  <button className="t-action" onClick={() => toggleComments(post.id)}>
                    <MessageSquare size={16} />
                    <span>{post.comments}</span>
                  </button>
                  <button className="t-action">
                    <Share2 size={16} />
                  </button>
                  <button className="t-action ml-auto">
                    <Bookmark size={16} />
                  </button>
                </div>

                {post.description && (
                  <p className="t-post-caption">{post.description}</p>
                )}

                {openComments.has(String(post.id)) && (
                  <div className="t-comments-panel">
                    <div className="t-comments-list">
                      {loadingComments[String(post.id)] ? (
                        <p className="t-muted-xs">Loading comments…</p>
                      ) : (commentsByPost[String(post.id)] || []).length > 0 ? (
                        commentsByPost[String(post.id)].map((comment) => (
                          <div key={comment.id} className="t-comment">
                            {comment.userAvatar ? (
                              <Image
                                src={comment.userAvatar}
                                alt={comment.userName}
                                width={32}
                                height={32}
                                className="t-avatar t-avatar-sm"
                              />
                            ) : (
                              <div className="t-avatar t-avatar-sm t-avatar-ph">
                                {comment.userName?.[0] ?? "U"}
                              </div>
                            )}
                            <div className="t-comment-body">
                              <div className="t-comment-head">
                                <span className="t-strong">{comment.userName}</span>
                                <span className="t-muted-xs">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p>{comment.content}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="t-muted-xs">No comments yet.</p>
                      )}
                    </div>

                    <div className="t-comment-form">
                      <textarea
                        value={commentDrafts[String(post.id)] || ""}
                        onChange={(e) =>
                          setCommentDrafts((state) => ({
                            ...state,
                            [String(post.id)]: e.target.value,
                          }))
                        }
                        placeholder={user ? "Add a comment…" : "Sign in to comment"}
                        disabled={!user}
                      />
                      <button
                        className="t-btn-quiet"
                        onClick={() => handleCommentSubmit(post.id)}
                        disabled={!user || !(commentDrafts[String(post.id)] || "").trim()}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}

                <div className="t-post-tags">
                  <span className="t-tag">#editorial</span>
                  <span className="t-tag">#studio</span>
                </div>
              </div>
            </article>
          ))}

          <div className="t-feed-end">You're caught up — last 24 hours.</div>
        </div>
      )}
    </div>
  )
}
