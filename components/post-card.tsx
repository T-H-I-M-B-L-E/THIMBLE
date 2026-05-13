"use client"

import Image from "next/image"
import { useState, useRef } from "react"
import { Heart, MessageSquare, Bookmark, Share2, MoreHorizontal, Trash2, Send, UserPlus, UserCheck } from "lucide-react"
import { useLike, useComments, useFollow } from "@/hooks/use-social"
import type { Comment } from "@/hooks/use-social"

export interface PostData {
  id: number | string
  userId?: string
  authorName: string
  authorAvatar: string
  imageUrl: string
  description: string
  likes: number
  commentCount?: number
  likedByMe?: boolean
  createdAt: string
}

interface PostCardProps {
  post: PostData
  currentUserId?: string
  onDelete: (id: string | number) => void
}

function SmallAvatar({ src, name, size = 40 }: { src?: string; name?: string; size?: number }) {
  if (src) {
    return (
      <div style={{ width: size, height: size, position: "relative", borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
        <Image src={src} alt={name || ""} fill style={{ objectFit: "cover" }} />
      </div>
    )
  }
  return (
    <div
      className="t-avatar t-avatar-ph"
      style={{ width: size, height: size, fontSize: size * 0.38, flexShrink: 0 }}
    >
      {name?.[0]?.toUpperCase() ?? "U"}
    </div>
  )
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return "just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="t-comment">
      <SmallAvatar src={comment.userAvatar} name={comment.userName} size={28} />
      <div className="t-comment-body">
        <div className="t-comment-head">
          <span className="t-strong">{comment.userName}</span>
          <span className="t-muted-xs">{formatDate(comment.createdAt)}</span>
        </div>
        <p>{comment.content}</p>
      </div>
    </div>
  )
}

export function PostCard({ post, currentUserId, onDelete }: PostCardProps) {
  const isOwn = !!currentUserId && currentUserId === post.userId
  const { count: likeCount, liked, toggle: toggleLike } = useLike(post.id, post.likes, post.likedByMe)
  const {
    comments, isLoading: commentsLoading, isOpen: commentsOpen,
    count: commentCount, toggle: toggleComments, addComment,
  } = useComments(post.id, post.commentCount ?? 0)
  const { isFollowing, isChecking, isSelf, toggle: toggleFollow } = useFollow(post.userId, currentUserId)

  const [commentInput, setCommentInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim() || submitting) return
    setSubmitting(true)
    const ok = await addComment(commentInput)
    if (ok) setCommentInput("")
    setSubmitting(false)
  }

  return (
    <article className="t-post">
      {/* Header */}
      <header className="t-post-head">
        <div className="t-post-author">
          <SmallAvatar src={post.authorAvatar} name={post.authorName} size={40} />
          <div className="t-post-author-meta">
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span className="t-strong" style={{ fontSize: 14 }}>{post.authorName}</span>
              {!isSelf && !isChecking && (
                <button
                  onClick={toggleFollow}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500,
                    border: "1px solid var(--t-line)",
                    background: isFollowing ? "var(--t-surface-2)" : "var(--t-ink)",
                    color: isFollowing ? "var(--t-ink-2)" : "var(--t-bg)",
                    cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  }}
                >
                  {isFollowing
                    ? <><UserCheck size={11} style={{ display: "inline" }} /> Following</>
                    : <><UserPlus size={11} style={{ display: "inline" }} /> Follow</>
                  }
                </button>
              )}
            </div>
            <div className="t-muted-xs">{formatDate(post.createdAt)}</div>
          </div>
        </div>

        {isOwn ? (
          <button
            onClick={() => onDelete(post.id)}
            style={{ background: "none", border: 0, cursor: "pointer", color: "var(--t-ink-3)", padding: 4 }}
            aria-label="Delete post"
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <button style={{ background: "none", border: 0, cursor: "pointer", color: "var(--t-ink-3)", padding: 4 }}>
            <MoreHorizontal size={16} />
          </button>
        )}
      </header>

      {/* Image */}
      <button className="t-post-image" aria-label="View post">
        <img src={post.imageUrl} alt={post.description || "Post"} loading="lazy" />
      </button>

      {/* Actions + Caption */}
      <div className="t-post-body">
        <div className="t-post-actions">
          <button
            className={`t-action ${liked ? "on" : ""}`}
            onClick={toggleLike}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            {likeCount > 0 && <span>{likeCount.toLocaleString()}</span>}
          </button>

          <button
            className={`t-action ${commentsOpen ? "on" : ""}`}
            onClick={toggleComments}
            aria-label="Toggle comments"
          >
            <MessageSquare size={16} />
            {commentCount > 0 && <span>{commentCount}</span>}
          </button>

          <button className="t-action" aria-label="Share">
            <Share2 size={16} />
          </button>

          <button
            className={`t-action ml-auto ${bookmarked ? "on" : ""}`}
            onClick={() => setBookmarked(b => !b)}
            aria-label="Bookmark"
          >
            <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
          </button>
        </div>

        {post.description && (
          <p className="t-post-caption">
            <span className="t-strong" style={{ fontSize: 14 }}>{post.authorName} </span>
            {post.description}
          </p>
        )}

        <div className="t-post-tags">
          <span className="t-tag">#editorial</span>
          <span className="t-tag">#studio</span>
        </div>

        {!commentsOpen && commentCount > 0 && (
          <button
            onClick={toggleComments}
            style={{
              background: "none", border: 0, color: "var(--t-ink-3)",
              fontSize: 13, cursor: "pointer", padding: "2px 0", fontFamily: "inherit",
            }}
          >
            View all {commentCount} comment{commentCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Comments panel */}
      {commentsOpen && (
        <div
          className="t-comments-panel"
          style={{ borderTop: "1px solid var(--t-line)", borderRadius: 0 }}
        >
          {commentsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
              <div
                className="animate-spin"
                style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }}
              />
            </div>
          ) : (
            <div className="t-comments-list">
              {comments.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--t-ink-3)", textAlign: "center", padding: "8px 0" }}>
                  No comments yet — be the first!
                </p>
              ) : (
                comments.map(c => <CommentItem key={c.id} comment={c} />)
              )}
            </div>
          )}

          <form className="t-comment-form" onSubmit={handleSubmitComment}>
            <input
              ref={inputRef}
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              placeholder="Add a comment…"
              maxLength={500}
              autoFocus
            />
            <button
              type="submit"
              disabled={!commentInput.trim() || submitting}
              style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                border: "none", cursor: commentInput.trim() ? "pointer" : "default",
                background: commentInput.trim() ? "var(--t-ink)" : "var(--t-surface-2)",
                color: commentInput.trim() ? "var(--t-bg)" : "var(--t-ink-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .15s, color .15s",
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
