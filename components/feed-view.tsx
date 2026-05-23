"use client"

import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/useAuth"
import { ImageIcon } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { PostCard } from "@/components/post-card"
import type { PostData } from "@/components/post-card"
import { InlineComposer } from "@/components/inline-composer"
import { useFollowing } from "@/hooks/use-social"
import { getCached, setCached, isFresh } from "@/lib/swr-cache"

const FEED_KEY = "feed:posts"

export function FeedView() {
  const { user } = useAuth()
  const { removeDesignPost } = useStore()
  const [posts, setPosts] = useState<PostData[]>(() => getCached<PostData[]>(FEED_KEY) ?? [])
  const [isLoading, setIsLoading] = useState(() => !isFresh(FEED_KEY))
  const [activeFilter, setActiveFilter] = useState("For you")
  const [toast, setToast] = useState<string | null>(null)
  const { following } = useFollowing(user?.id)

  const visiblePosts = (() => {
    if (activeFilter === "Following") {
      const followingIds = new Set(following.map(f => f.userId))
      return posts.filter(p => p.userId && followingIds.has(p.userId) && p.userId !== user?.id)
    }
    return posts
  })()

  useEffect(() => {
    // Always revalidate on mount; the UI is already showing cached posts (if any),
    // so this is a silent background refresh rather than a blocking load.
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    const hasCached = (getCached<PostData[]>(FEED_KEY)?.length ?? 0) > 0
    if (!hasCached) setIsLoading(true)
    try {
      const res = await fetch("/api/posts", { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const arr = Array.isArray(data) ? data : []
      setPosts(arr)
      setCached(FEED_KEY, arr)
    } catch (err) {
      console.error("Failed to fetch posts:", err)
      if (!hasCached) setPosts([])
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
        setPosts(prev => {
          const next = prev.filter(p => String(p.id) !== String(postId))
          setCached(FEED_KEY, next)
          return next
        })
        removeDesignPost(String(postId))
      } else {
        const error = await res.json().catch(() => ({}))
        alert("Failed to delete: " + (error.error || "Unknown error"))
      }
    } catch {
      alert("Network error. Please try again.")
    }
  }

  const addOptimistic = useCallback((post: PostData) => {
    setPosts(prev => {
      const next = [post, ...prev]
      setCached(FEED_KEY, next)
      return next
    })
    return String(post.id)
  }, [])

  const commitOptimistic = useCallback((tempId: string, real: PostData) => {
    setPosts(prev => {
      const next = prev.map(p => (String(p.id) === tempId ? real : p))
      setCached(FEED_KEY, next)
      return next
    })
  }, [])

  const revertOptimistic = useCallback((tempId: string, error: string) => {
    if (tempId) {
      setPosts(prev => {
        const next = prev.filter(p => String(p.id) !== tempId)
        setCached(FEED_KEY, next)
        return next
      })
    }
    setToast(error)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const filterTabs = ["For you", "Following", "Designers", "Models", "Photographers", "Brands"]

  return (
    <div className="t-feed">
      <InlineComposer
        user={user}
        onOptimistic={addOptimistic}
        onCommit={commitOptimistic}
        onRevert={revertOptimistic}
      />

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
      ) : visiblePosts.length === 0 ? (
        <div className="t-empty-state">
          <div className="t-empty-state-icon">
            <ImageIcon size={24} />
          </div>
          <h3>{activeFilter === "Following" ? "Nothing from people you follow yet" : "Nothing here yet"}</h3>
          <p>{activeFilter === "Following" ? "Follow people to see their posts here." : "Be the first to share — write something above."}</p>
        </div>
      ) : (
        <div className="t-feed-stream">
          {visiblePosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onDelete={handleDelete}
            />
          ))}
          <div className="t-feed-end">You're caught up.</div>
        </div>
      )}

      {toast && <div className="t-toast" role="status">{toast}</div>}
    </div>
  )
}
