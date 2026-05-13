"use client"

import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/useAuth"
import { ImageIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { PostCard } from "@/components/post-card"
import type { PostData } from "@/components/post-card"

export function FeedView() {
  const { user } = useAuth()
  const { removeDesignPost } = useStore()
  const [posts, setPosts] = useState<PostData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState("For you")

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setIsLoading(true)
    try {
      // Route through /api/posts proxy to avoid CORS and carry auth cookie
      const res = await fetch("/api/posts", { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to fetch posts:", err)
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
      if (res.ok || res.status === 204) {
        setPosts(prev => prev.filter(p => String(p.id) !== String(postId)))
        removeDesignPost(String(postId))
      } else {
        const error = await res.json().catch(() => ({}))
        alert("Failed to delete: " + (error.error || "Unknown error"))
      }
    } catch {
      alert("Network error. Please try again.")
    }
  }

  const filterTabs = ["For you", "Following", "Designers", "Models", "Photographers", "Brands"]

  return (
    <div className="t-feed">
      {/* Composer Bar */}
      <div className="t-composer-bar">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt="Me"
            className="t-avatar"
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div className="t-avatar t-avatar-ph">
            {user?.fullName?.[0] ?? "U"}
          </div>
        )}
        <button className="t-composer-input">What are you working on?</button>
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
        {filterTabs.map(tab => (
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
          <div
            className="animate-spin rounded-full"
            style={{ width: 48, height: 48, border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }}
          />
        </div>
      ) : posts.length === 0 ? (
        <div className="t-empty-state">
          <div className="t-empty-state-icon">
            <ImageIcon size={24} />
          </div>
          <h3>Nothing here yet</h3>
          <p>Be the first to share your work — use the composer above to post a photo.</p>
        </div>
      ) : (
        <div className="t-feed-stream">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onDelete={handleDelete}
            />
          ))}
          <div className="t-feed-end">You're caught up — last 24 hours.</div>
        </div>
      )}
    </div>
  )
}
