"use client"

import { useStore } from "@/lib/store"
import { useUser } from "@clerk/nextjs"
import Image from "next/image"
import { Heart, MessageSquare, Bookmark, Share2, Plus, MoreHorizontal, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { getApiUrl } from "@/lib/platform"

interface Post {
  id: number | string
  userId?: string
  authorName: string
  authorAvatar: string
  imageUrl: string
  description: string
  likes: number
  createdAt: string
}

export function FeedView() {
  const { user: clerkUser } = useUser()
  const { designPosts, removeDesignPost } = useStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState("For you")
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    const postsUrl = getApiUrl("/api/posts")

    if (!postsUrl) {
      setPosts(
        designPosts.map((post) => ({
          id: post.id,
          userId: post.userId,
          authorName: post.author,
          authorAvatar: post.authorAvatar || "",
          imageUrl: post.image,
          description: post.description,
          likes: post.likes,
          createdAt: post.createdAt,
        }))
      )
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(postsUrl)
      const data = await res.json()
      setPosts(data)
    } catch (err) {
      console.error("Failed to fetch posts:", err)
      setPosts(
        designPosts.map((post) => ({
          id: post.id,
          userId: post.userId,
          authorName: post.author,
          authorAvatar: post.authorAvatar || "",
          imageUrl: post.image,
          description: post.description,
          likes: post.likes,
          createdAt: post.createdAt,
        }))
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (postId: number | string) => {
    if (!confirm("Are you sure you want to delete this post?")) return

    const postsUrl = getApiUrl(`/api/posts/${postId}`)

    if (!postsUrl) {
      removeDesignPost(String(postId))
      setPosts(posts.filter(p => String(p.id) !== String(postId)))
      return
    }

    try {
      const res = await fetch(postsUrl, {
        method: "DELETE"
      })
      if (res.ok) {
        setPosts(posts.filter(p => String(p.id) !== String(postId)))
      } else {
        const error = await res.json()
        alert("Failed to delete: " + (error.error || "Unknown error"))
      }
    } catch (err) {
      console.error("Failed to delete post:", err)
      alert("Network error. This action needs a live backend connection.")
    }
  }

  const toggleLike = (postId: string | number) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(String(postId))) {
        newSet.delete(String(postId))
      } else {
        newSet.add(String(postId))
      }
      return newSet
    })
  }

  const filterTabs = ["For you", "Following", "Designers", "Models", "Photographers", "Brands"]

  return (
    <div className="t-feed">
      {/* Composer Bar */}
      <div className="t-composer-bar">
        {clerkUser?.imageUrl ? (
          <Image
            src={clerkUser.imageUrl}
            alt="Me"
            width={40}
            height={40}
            className="t-avatar"
            style={{ borderRadius: "50%" }}
          />
        ) : (
          <div className="t-avatar t-avatar-ph">
            {clerkUser?.firstName?.[0] ?? "U"}
          </div>
        )}
        <button className="t-composer-input" onClick={() => {}}>
          What are you working on?
        </button>
        <div className="t-composer-actions">
          <button className="t-chip">
            <span className="t-chip-dot photo" />
            Photo
          </button>
          <button className="t-chip">
            <span className="t-chip-dot gig" />
            Gig
          </button>
          <button className="t-chip">
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
                {clerkUser?.id === post.userId && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    style={{ background: "none", border: 0, cursor: "pointer", color: "var(--t-ink-2)", padding: "4px" }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {!clerkUser || clerkUser?.id !== post.userId && (
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
                    className={`t-action ${likedPosts.has(String(post.id)) ? "on" : ""}`}
                    onClick={() => toggleLike(post.id)}
                  >
                    <Heart size={16} fill={likedPosts.has(String(post.id)) ? "currentColor" : "none"} />
                    <span>{post.likes}</span>
                  </button>
                  <button className="t-action">
                    <MessageSquare size={16} />
                    <span>18</span>
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
