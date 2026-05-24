"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Trash2,
} from "lucide-react";
import type { PostData } from "@/components/post-card";
import { useLike, useComments, useBookmark, prefetchComments } from "@/hooks/use-social";
import { useAuth } from "@/lib/useAuth";
import { Avatar } from "@/components/avatar";
import { VerifiedBadge } from "@/components/verified-badge";

interface PostDetail extends PostData {
  userId: string;
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;
  const { user } = useAuth();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Hooks must be called unconditionally — use safe defaults when post is null
  const {
    count: likeCount,
    liked,
    toggle: toggleLike,
  } = useLike(post?.id ?? 0, post?.likes ?? 0, post?.likedByMe);
  const {
    comments,
    isLoading: commentsLoading,
    count: commentCount,
    open: openComments,
    addComment,
  } = useComments(post?.id ?? 0, post?.commentCount ?? 0);
  const { saved: bookmarked, toggle: toggleBookmark } = useBookmark(post?.id ?? 0, post?.savedByMe);

  const isOwn = !!user && !!post && user.id === post.userId;

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm("Delete this post? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        router.push(`/dashboard/${user?.role ?? "designer"}/feed`);
      } else {
        alert("Could not delete from server.");
      }
    } catch {
      alert("Network error.");
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post?.description || "THIMBLE", url });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch post");
        const found = await res.json();
        if (found && found.id) setPost(found as PostDetail);
      } catch (err) {
        console.error("Failed to fetch post:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  useEffect(() => {
    if (post?.id) openComments();
  }, [post?.id, openComments]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2"
          style={{ borderColor: "var(--t-gold)" }}
        />
      </div>
    );
  }

  if (!post) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--t-ink-2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <p style={{ color: "var(--t-ink-2)" }}>Post not found</p>
      </div>
    );
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    const ok = await addComment(commentInput);
    if (ok) setCommentInput("");
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--t-bg)" }}>
      {/* OG meta — injected via document.title in client component */}
      {typeof document !== "undefined" &&
        (() => {
          document.title = post.description || "Post — THIMBLE";
          return null;
        })()}

      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--t-surface)",
          borderBottom: "1px solid var(--t-line)",
          padding: "14px 24px",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--t-ink-2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr clamp(280px, 33%, 400px)",
            gap: 32,
          }}
        >
          {/* Left: image + description + comments */}
          <div>
            {post.imageUrl && (
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "var(--t-surface-2)",
                  marginBottom: 24,
                }}
              >
                <img
                  src={post.imageUrl}
                  alt={post.description || "Post"}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            )}

            {post.description && (
              <div style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "var(--t-ink)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {post.authorName}
                  {post.authorVerified && <VerifiedBadge size={15} />}
                </h2>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: "var(--t-ink-2)",
                  }}
                >
                  {post.description}
                </p>
              </div>
            )}

            {/* Comments */}
            <div style={{ marginTop: 32 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 16,
                  color: "var(--t-ink)",
                }}
              >
                Replies ({commentCount})
              </h3>

              <form
                onSubmit={handleSubmitComment}
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 24,
                  padding: 16,
                  background: "var(--t-surface)",
                  borderRadius: 12,
                  border: "1px solid var(--t-line)",
                }}
              >
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Share your thoughts…"
                  maxLength={500}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 14,
                    color: "var(--t-ink)",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || submitting}
                  style={{
                    padding: "8px 16px",
                    background: commentInput.trim()
                      ? "var(--t-ink)"
                      : "var(--t-surface-2)",
                    color: commentInput.trim() ? "white" : "var(--t-ink-3)",
                    border: "none",
                    borderRadius: 8,
                    cursor: commentInput.trim() ? "pointer" : "default",
                    fontSize: 13,
                    fontWeight: 500,
                    transition: "background .15s",
                  }}
                >
                  Reply
                </button>
              </form>

              {commentsLoading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: 24,
                  }}
                >
                  <div
                    className="animate-spin rounded-full h-8 w-8 border-t-2"
                    style={{ borderColor: "var(--t-gold)" }}
                  />
                </div>
              ) : comments.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--t-ink-3)",
                    fontSize: 13,
                    padding: 24,
                  }}
                >
                  No replies yet — be the first to share your thoughts.
                </p>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      style={{
                        padding: 12,
                        background: "var(--t-surface)",
                        borderRadius: 12,
                        border: "1px solid var(--t-line)",
                        display: "flex",
                        gap: 12,
                      }}
                    >
                      <Avatar
                        name={comment.userName}
                        image={comment.userAvatar}
                        size={32}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 4,
                          }}
                        >
                          <p
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              color: "var(--t-ink)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {comment.userName}
                            {comment.userVerified && (
                              <VerifiedBadge size={12} />
                            )}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--t-ink-3)" }}>
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--t-ink-2)",
                            lineHeight: 1.4,
                          }}
                        >
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: sidebar */}
          <div>
            {/* Author */}
            <div
              style={{
                padding: 16,
                background: "var(--t-surface)",
                borderRadius: 12,
                border: "1px solid var(--t-line)",
                marginBottom: 16,
              }}
            >
              <button
                onClick={() => {
                  prefetchComments(post.id);
                  router.push(`/dashboard/designer/profile/${post.userId}`);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Avatar
                  name={post.authorName}
                  image={post.authorAvatar}
                  size={44}
                />
                <div>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "var(--t-ink)",
                      textAlign: "left",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {post.authorName}
                    {post.authorVerified && <VerifiedBadge size={12} />}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--t-ink-3)",
                      textAlign: "left",
                    }}
                  >
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
              <button
                onClick={() =>
                  router.push(`/dashboard/designer/profile/${post.userId}`)
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--t-ink)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                View Profile
              </button>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 16,
                background: "var(--t-surface)",
                borderRadius: 12,
                border: "1px solid var(--t-line)",
              }}
            >
              <button
                onClick={toggleLike}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  background: liked
                    ? "var(--t-gold-soft)"
                    : "var(--t-surface-2)",
                  color: liked ? "var(--t-gold-ink)" : "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Heart
                  size={16}
                  fill={liked ? "currentColor" : "none"}
                  strokeWidth={1.75}
                />
                {likeCount > 0
                  ? `${likeCount} Like${likeCount !== 1 ? "s" : ""}`
                  : "Like"}
              </button>

              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  background: "var(--t-surface-2)",
                  color: "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <MessageCircle size={16} strokeWidth={1.75} />
                {commentCount} {commentCount === 1 ? "Reply" : "Replies"}
              </button>

              <button
                onClick={handleShare}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  background: shareCopied
                    ? "var(--t-gold-soft)"
                    : "var(--t-surface-2)",
                  color: shareCopied ? "var(--t-gold-ink)" : "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  transition: "background .15s",
                }}
              >
                <Share2 size={16} strokeWidth={1.75} />
                {shareCopied ? "Link copied!" : "Share"}
              </button>

              <button
                onClick={toggleBookmark}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  background: bookmarked
                    ? "var(--t-gold-soft)"
                    : "var(--t-surface-2)",
                  color: bookmarked ? "var(--t-gold-ink)" : "var(--t-ink)",
                  border: "1px solid var(--t-line)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Bookmark
                  size={16}
                  fill={bookmarked ? "currentColor" : "none"}
                  strokeWidth={1.75}
                />
                {bookmarked ? "Saved" : "Save"}
              </button>

              {isOwn && (
                <button
                  onClick={handleDelete}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    background: "var(--t-surface-2)",
                    color: "#c44",
                    border: "1px solid var(--t-line)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
