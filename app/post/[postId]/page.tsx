"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark } from "lucide-react"
import type { PostData } from "@/components/post-card"
import { useLike, useComments } from "@/hooks/use-social"
import { useAuth } from "@/lib/useAuth"
import { Avatar } from "@/components/avatar"

interface PostDetail extends PostData {
  userId: string
}

export default function PostDetailPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.postId as string
  const { user } = useAuth()

  const [post, setPost] = useState<PostDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [commentInput, setCommentInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch("/api/posts", { credentials: "include" })
        if (!res.ok) throw new Error("Failed to fetch posts")
        const posts = await res.json()
        const found = posts.find((p: PostData) => String(p.id) === String(postId))
        if (found) {
          setPost(found as PostDetail)
        }
      } catch (err) {
        console.error("Failed to fetch post:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPost()
  }, [postId])

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
      </div>
    )
  }

  if (!post) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <button
          onClick={() => router.back()}
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--t-ink-2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <p style={{ color: "var(--t-ink-2)" }}>Post not found</p>
      </div>
    )
  }

  const { count: likeCount, liked, toggle: toggleLike } = useLike(post.id, post.likes, post.likedByMe)
  const {
    comments, isLoading: commentsLoading, count: commentCount, addComment,
  } = useComments(post.id, post.commentCount ?? 0)

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim() || submitting) return
    setSubmitting(true)
    const ok = await addComment(commentInput)
    if (ok) setCommentInput("")
    setSubmitting(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--t-bg)" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--t-surface)", borderBottom: "1px solid var(--t-line)", padding: "16px 24px" }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--t-ink-2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "32px" }}>
          {/* Image Section */}
          <div>
            {post.imageUrl && (
              <div style={{ borderRadius: "16px", overflow: "hidden", background: "var(--t-surface-2)", marginBottom: "24px" }}>
                <img
                  src={post.imageUrl}
                  alt={post.description || "Post"}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            )}

            {/* Description */}
            {post.description && (
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", color: "var(--t-ink)" }}>
                  {post.authorName}
                </h2>
                <p style={{ fontSize: "15px", lineHeight: "1.5", color: "var(--t-ink-2)" }}>
                  {post.description}
                </p>
              </div>
            )}

            {/* Comments Section */}
            <div style={{ marginTop: "32px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", color: "var(--t-ink)" }}>
                Replies ({commentCount})
              </h3>

              <form
                onSubmit={handleSubmitComment}
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "24px",
                  padding: "16px",
                  background: "var(--t-surface)",
                  borderRadius: "12px",
                  border: "1px solid var(--t-line)",
                }}
              >
                <input
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  placeholder="Share your thoughts…"
                  maxLength={500}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: "14px",
                    color: "var(--t-ink)",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || submitting}
                  style={{
                    padding: "8px 16px",
                    background: !commentInput.trim() ? "var(--t-surface-2)" : "var(--t-ink)",
                    color: !commentInput.trim() ? "var(--t-ink-3)" : "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: !commentInput.trim() ? "default" : "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                    transition: "background .15s",
                  }}
                >
                  Reply
                </button>
              </form>

              {commentsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "24px" }}>
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
                </div>
              ) : comments.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--t-ink-3)", fontSize: "13px", padding: "24px" }}>
                  No replies yet — be the first to share your thoughts.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {comments.map(comment => (
                    <div
                      key={comment.id}
                      style={{
                        padding: "12px",
                        background: "var(--t-surface)",
                        borderRadius: "12px",
                        border: "1px solid var(--t-line)",
                        display: "flex",
                        gap: "12px",
                      }}
                    >
                      <Avatar name={comment.userName} image={comment.userAvatar} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                          <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t-ink)" }}>
                            {comment.userName}
                          </p>
                          <p style={{ fontSize: "12px", color: "var(--t-ink-3)" }}>
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p style={{ fontSize: "13px", color: "var(--t-ink-2)", lineHeight: "1.4" }}>
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Actions & Stats */}
          <div>
            {/* Author Info */}
            <div style={{ padding: "16px", background: "var(--t-surface)", borderRadius: "12px", border: "1px solid var(--t-line)", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <Avatar name={post.authorName} image={post.authorAvatar} size={44} />
                <div>
                  <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t-ink)" }}>
                    {post.authorName}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--t-ink-3)" }}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--t-ink)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                View Profile
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "var(--t-surface)", borderRadius: "12px", border: "1px solid var(--t-line)" }}>
              <button
                onClick={toggleLike}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  background: liked ? "var(--t-gold-soft)" : "var(--t-surface-2)",
                  color: liked ? "var(--t-gold-ink)" : "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} strokeWidth={1.75} />
                {likeCount > 0 ? `${likeCount} Like${likeCount !== 1 ? "s" : ""}` : "Like"}
              </button>

              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  background: "var(--t-surface-2)",
                  color: "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                <MessageCircle size={16} strokeWidth={1.75} />
                {commentCount} Reply{commentCount !== 1 ? "ies" : ""}
              </button>

              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  background: "var(--t-surface-2)",
                  color: "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                <Share2 size={16} strokeWidth={1.75} />
                Share
              </button>

              <button
                onClick={() => setBookmarked(b => !b)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  background: bookmarked ? "var(--t-gold-soft)" : "var(--t-surface-2)",
                  color: bookmarked ? "var(--t-gold-ink)" : "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} strokeWidth={1.75} />
                {bookmarked ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
