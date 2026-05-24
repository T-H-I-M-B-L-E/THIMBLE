"use client"

import { useState, useEffect } from "react"
import { X, Heart, MessageCircle, Share2, Bookmark, Trash2 } from "lucide-react"
import type { PostData } from "@/components/post-card"
import { useLike, useComments, useBookmark, prefetchComments } from "@/hooks/use-social"
import { useAuth } from "@/lib/useAuth"
import { Avatar } from "@/components/avatar"
import { VerifiedBadge } from "@/components/verified-badge"

interface PostLightboxProps {
  post: PostData
  isOpen: boolean
  onClose: () => void
}

export function PostLightbox({ post, isOpen, onClose }: PostLightboxProps) {
  const [commentInput, setCommentInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [expandCaption, setExpandCaption] = useState(false)

  const { user } = useAuth()
  const { count: likeCount, liked, toggle: toggleLike } = useLike(post.id, post.likes, post.likedByMe)
  const { saved: bookmarked, toggle: toggleBookmark } = useBookmark(post.id, post.savedByMe)
  const {
    comments, isLoading: commentsLoading, count: commentCount, addComment, deleteComment,
  } = useComments(post.id, post.commentCount ?? 0)

  // Load comments when modal opens
  useEffect(() => {
    if (isOpen) {
      prefetchComments(post.id)
    }
  }, [isOpen, post.id])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim() || submitting) return
    setSubmitting(true)
    const ok = await addComment(commentInput)
    if (ok) setCommentInput("")
    setSubmitting(false)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          zIndex: 100,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          background: "var(--t-surface)",
          borderRadius: "20px",
          border: "1px solid var(--t-line)",
          width: "90vw",
          maxWidth: "1000px",
          maxHeight: "90vh",
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 102,
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "var(--t-ink)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.2)"
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.1)"
          }}
        >
          <X size={20} />
        </button>

        {/* Image Section */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--t-surface-2)",
            overflow: "auto",
          }}
        >
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt={post.description || "Post"}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          )}
        </div>

        {/* Details Section */}
        <div
          style={{
            width: "380px",
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--t-line)",
          }}
        >
          {/* Header */}
          <div style={{ padding: "16px", borderBottom: "1px solid var(--t-line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Avatar name={post.authorName} image={post.authorAvatar} size={40} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--t-ink)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {post.authorName}
                  {post.authorVerified && <VerifiedBadge size={13} />}
                </p>
                <p style={{ fontSize: "12px", color: "var(--t-ink-3)" }}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {post.description && (
            <div style={{ padding: "16px", borderBottom: "1px solid var(--t-line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Avatar name={post.authorName} image={post.authorAvatar} size={28} />
                <p style={{ fontWeight: 600, fontSize: "12px", color: "var(--t-ink)" }}>
                  {post.authorName}
                </p>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--t-ink-2)",
                  lineHeight: "1.5",
                  display: expandCaption ? "block" : "-webkit-box",
                  WebkitLineClamp: expandCaption ? "unset" : 3,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: expandCaption ? "visible" : "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {post.description}
              </p>
              {post.description.length > 150 && (
                <button
                  onClick={() => setExpandCaption(!expandCaption)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--t-ink-3)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 500,
                    marginTop: "6px",
                    padding: 0,
                  }}
                >
                  {expandCaption ? "show less" : "show more"}
                </button>
              )}
            </div>
          )}

          {/* Comments */}
          <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--t-ink-3)", marginBottom: "12px" }}>
              {commentCount} Reply{commentCount !== 1 ? "ies" : ""}
            </p>
            {commentsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "12px" }}>
                <div className="animate-spin rounded-full h-6 w-6 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
              </div>
            ) : comments.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--t-ink-3)" }}>No replies yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {comments.map(comment => (
                  <div key={comment.id} style={{ fontSize: "12px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <Avatar name={comment.userName} image={comment.userAvatar} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, color: "var(--t-ink)", marginBottom: "2px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {comment.userName}
                        {comment.userVerified && <VerifiedBadge size={10} />}
                      </p>
                      <p style={{ color: "var(--t-ink-2)", fontSize: "11px", wordBreak: "break-word" }}>{comment.content}</p>
                    </div>
                    {user?.id === comment.userId && (
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this reply?")) return
                          await deleteComment(comment.id)
                        }}
                        aria-label="Delete reply"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t-ink-3)", padding: 2, display: "flex", alignItems: "center" }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: "12px", borderTop: "1px solid var(--t-line)" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                onClick={toggleLike}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: liked ? "var(--t-gold-soft)" : "var(--t-surface-2)",
                  color: liked ? "var(--t-gold-ink)" : "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <Heart size={14} fill={liked ? "currentColor" : "none"} strokeWidth={1.75} />
                {likeCount}
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "8px",
                  background: "var(--t-surface-2)",
                  color: "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <MessageCircle size={14} strokeWidth={1.75} />
                {commentCount}
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "8px",
                  background: "var(--t-surface-2)",
                  color: "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <Share2 size={14} strokeWidth={1.75} />
              </button>
              <button
                onClick={toggleBookmark}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: bookmarked ? "var(--t-gold-soft)" : "var(--t-surface-2)",
                  color: bookmarked ? "var(--t-gold-ink)" : "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} strokeWidth={1.75} />
              </button>
            </div>

            {/* Comment Input */}
            <form onSubmit={handleSubmitComment} style={{ display: "flex", gap: "8px" }}>
              <input
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Reply…"
                maxLength={500}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  border: "1px solid var(--t-line)",
                  borderRadius: "8px",
                  background: "var(--t-surface-2)",
                  fontSize: "12px",
                  color: "var(--t-ink)",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!commentInput.trim() || submitting}
                style={{
                  padding: "8px 12px",
                  background: !commentInput.trim() ? "var(--t-surface-2)" : "var(--t-ink)",
                  color: !commentInput.trim() ? "var(--t-ink-3)" : "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: !commentInput.trim() ? "default" : "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                ↵
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
