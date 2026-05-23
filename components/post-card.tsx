"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Send,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { SharePopover } from "@/components/SharePopover";
import {
  useLike,
  useComments,
  useFollow,
  prefetchComments,
} from "@/hooks/use-social";
import type { Comment } from "@/hooks/use-social";
import { useUsers } from "@/hooks/use-users";
import { Avatar } from "@/components/avatar";
import { VerifiedBadge } from "@/components/verified-badge";

export interface PostData {
  id: number | string;
  userId?: string;
  authorName: string;
  authorAvatar: string;
  authorVerified?: boolean;
  imageUrl: string;
  description: string;
  likes: number;
  commentCount?: number;
  likedByMe?: boolean;
  createdAt: string;
  taggedUsers?: string[];
}

interface PostCardProps {
  post: PostData;
  currentUserId?: string;
  onDelete: (id: string | number) => void;
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="t-comment">
      <Avatar name={comment.userName} image={comment.userAvatar} size={28} />
      <div className="t-comment-body">
        <div className="t-comment-head">
          <span
            className="t-strong"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            {comment.userName}
            {comment.userVerified && <VerifiedBadge size={12} />}
          </span>
          <span className="t-muted-xs">{formatDate(comment.createdAt)}</span>
        </div>
        <p>{comment.content}</p>
      </div>
    </div>
  );
}

export function PostCard({ post, currentUserId, onDelete }: PostCardProps) {
  const router = useRouter();
  const isOwn = !!currentUserId && currentUserId === post.userId;
  const {
    count: likeCount,
    liked,
    toggle: toggleLike,
  } = useLike(post.id, post.likes, post.likedByMe);
  const {
    comments,
    isLoading: commentsLoading,
    isOpen: commentsOpen,
    count: commentCount,
    toggle: toggleComments,
    addComment,
  } = useComments(post.id, post.commentCount ?? 0);
  const {
    isFollowing,
    isChecking,
    isSelf,
    toggle: toggleFollow,
  } = useFollow(post.userId, currentUserId);

  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { lookup } = useUsers();
  const taggedDisplay = (post.taggedUsers ?? [])
    .map((id) => {
      const u = lookup(id);
      return u ? { id, name: u.fullName, role: u.role } : null;
    })
    .filter(Boolean) as { id: string; name: string; role?: string }[];

  const postUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/post/${post.id}`
      : `/post/${post.id}`;

  const handleTaggedUserClick = (userId: string, userRole?: string) => {
    const role = userRole?.toLowerCase() || "designer";
    prefetchComments(post.id);
    router.push(`/dashboard/${role}/profile/${userId}`);
  };

  const handleAuthorClick = () => {
    if (!post.userId) return;
    prefetchComments(post.id);
    router.push(`/dashboard/designer/profile/${post.userId}`);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    const ok = await addComment(commentInput);
    if (ok) setCommentInput("");
    setSubmitting(false);
  };

  return (
    <article className="t-post">
      <button
        onClick={handleAuthorClick}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <Avatar name={post.authorName} image={post.authorAvatar} size={40} />
      </button>

      <div className="t-post-main">
        <header className="t-post-head">
          <div className="t-post-head-meta">
            <button
              onClick={handleAuthorClick}
              className="t-post-name"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "inherit",
                font: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {post.authorName}
              {post.authorVerified && <VerifiedBadge size={13} />}
            </button>
            <span className="t-post-dot">·</span>
            <span className="t-post-time">{formatDate(post.createdAt)}</span>
            {!isSelf && !isChecking && (
              <button
                onClick={toggleFollow}
                className={`t-follow-mini ${isFollowing ? "is-following" : ""}`}
                type="button"
              >
                {isFollowing ? (
                  <>
                    <UserCheck size={11} /> Following
                  </>
                ) : (
                  <>
                    <UserPlus size={11} /> Follow
                  </>
                )}
              </button>
            )}
          </div>

          {isOwn ? (
            <button
              onClick={() => onDelete(post.id)}
              className="t-post-more"
              aria-label="Delete post"
            >
              <Trash2 size={15} />
            </button>
          ) : (
            <button className="t-post-more" aria-label="More">
              <MoreHorizontal size={15} />
            </button>
          )}
        </header>

        {post.description && <p className="t-post-text">{post.description}</p>}

        {taggedDisplay.length > 0 && (
          <p className="t-post-tagged">
            <span>with </span>
            {taggedDisplay.map((t, i) => (
              <button
                key={t.id}
                className="t-post-tagged-name"
                onClick={() => handleTaggedUserClick(t.id, t.role)}
                type="button"
              >
                @{t.name}
                {i < taggedDisplay.length - 1 ? ", " : ""}
              </button>
            ))}
          </p>
        )}

        {post.imageUrl && (
          <button className="t-post-image" aria-label="View post" type="button">
            <img
              src={post.imageUrl}
              alt={post.description || "Post"}
              loading="lazy"
            />
          </button>
        )}

        <div className="t-post-actions">
          <button
            className={`t-action ${liked ? "on like" : ""}`}
            onClick={toggleLike}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              size={16}
              fill={liked ? "currentColor" : "none"}
              strokeWidth={1.75}
            />
            {likeCount > 0 && <span>{likeCount.toLocaleString()}</span>}
          </button>

          <button
            className={`t-action ${commentsOpen ? "on" : ""}`}
            onClick={toggleComments}
            onMouseEnter={() => prefetchComments(post.id)}
            onPointerDown={() => prefetchComments(post.id)}
            onFocus={() => prefetchComments(post.id)}
            aria-label="Toggle comments"
          >
            <MessageCircle size={16} strokeWidth={1.75} />
            {commentCount > 0 && <span>{commentCount}</span>}
          </button>

          <SharePopover
            postId={post.id}
            postUrl={postUrl}
            title={post.description || post.authorName}
          />

          <button
            className={`t-action ml-auto ${bookmarked ? "on" : ""}`}
            onClick={() => setBookmarked((b) => !b)}
            aria-label="Bookmark"
          >
            <Bookmark
              size={16}
              fill={bookmarked ? "currentColor" : "none"}
              strokeWidth={1.75}
            />
          </button>
        </div>

        {!commentsOpen && commentCount > 0 && (
          <button
            onClick={toggleComments}
            className="t-post-viewall"
            type="button"
          >
            View all {commentCount} comment{commentCount !== 1 ? "s" : ""}
          </button>
        )}

        {commentsOpen && (
          <div className="t-comments-panel">
            {commentsLoading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 16,
                }}
              >
                <div
                  className="animate-spin"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: "2px solid var(--t-line)",
                    borderTopColor: "var(--t-gold)",
                  }}
                />
              </div>
            ) : (
              <div className="t-comments-list">
                {comments.length === 0 ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--t-ink-3)",
                      padding: "4px 0",
                    }}
                  >
                    No replies yet — start the thread.
                  </p>
                ) : (
                  comments.map((c) => <CommentItem key={c.id} comment={c} />)
                )}
              </div>
            )}

            <form className="t-comment-form" onSubmit={handleSubmitComment}>
              <input
                ref={inputRef}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Reply…"
                maxLength={500}
                autoFocus
              />
              <button
                type="submit"
                disabled={!commentInput.trim() || submitting}
                className="t-comment-send"
                aria-label="Send reply"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
