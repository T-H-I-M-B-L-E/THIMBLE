"use client"

import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/useAuth"
import { ImageIcon } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { PostCard } from "@/components/post-card"
import type { PostData } from "@/components/post-card"
import { InlineComposer } from "@/components/inline-composer"
import { useFollowing } from "@/hooks/use-social"
import { useInfinite } from "@/hooks/use-infinite"
import { useNotify } from "@/components/notify-provider"
import { getCached, setCached } from "@/lib/swr-cache"

const FEED_KEY = "feed:posts"

export function FeedView() {
  const { user } = useAuth()
  const { removeDesignPost } = useStore()
  const [activeFilter, setActiveFilter] = useState("For you")
  const [toast, setToast] = useState<string | null>(null)
  const { following } = useFollowing(user?.id)
  const notify = useNotify()

  // Cursor pagination: pageCursor is the id of the last seen post; pass
  // null for the first page. Backend returns up to 20 at a time.
  const fetchPage = useCallback(async (pageCursor: string | null) => {
    const url = pageCursor ? `/api/posts?before=${encodeURIComponent(pageCursor)}` : "/api/posts"
    const res = await fetch(url, { credentials: "include" })
    if (!res.ok) throw new Error("Failed to load")
    const data = await res.json()
    const arr: PostData[] = Array.isArray(data) ? data : []
    return {
      items: arr,
      // If the backend returns fewer than the page size, we know we're done.
      nextCursor: arr.length === 20 ? String(arr[arr.length - 1].id) : null,
    }
  }, [])

  const {
    items: posts,
    isLoading,
    isLoadingMore,
    hasMore,
    sentinelRef,
    setItems: setPosts,
  } = useInfinite<PostData>(fetchPage)

  // Seed first paint from the SWR cache for perceived speed, then let the
  // hook's revalidation replace it.
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (seeded) return
    const cached = getCached<PostData[]>(FEED_KEY)
    if (cached && cached.length > 0) setPosts(cached)
    setSeeded(true)
  }, [seeded, setPosts])

  // Keep the cache in sync with the first page worth of posts only —
  // we don't want to balloon localStorage with hundreds of items.
  useEffect(() => {
    if (posts.length === 0) return
    setCached(FEED_KEY, posts.slice(0, 20))
  }, [posts])

  const visiblePosts = (() => {
    if (activeFilter === "Following") {
      const followingIds = new Set(following.map(f => f.userId))
      return posts.filter(p => p.userId && followingIds.has(p.userId) && p.userId !== user?.id)
    }
    return posts
  })()

  const handleDelete = async (postId: number | string) => {
    const ok = await notify.confirm({
      title: "Delete this post?",
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return
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
        notify.error("Failed to delete: " + (error.error || "Unknown error"))
      }
    } catch {
      notify.error("Network error. Please try again.")
    }
  }

  const addOptimistic = useCallback((post: PostData) => {
    setPosts(prev => [post, ...prev])
    return String(post.id)
  }, [setPosts])

  const commitOptimistic = useCallback((tempId: string, real: PostData) => {
    setPosts(prev => prev.map(p => (String(p.id) === tempId ? real : p)))
  }, [setPosts])

  const revertOptimistic = useCallback((tempId: string, error: string) => {
    if (tempId) setPosts(prev => prev.filter(p => String(p.id) !== tempId))
    setToast(error)
    setTimeout(() => setToast(null), 4000)
  }, [setPosts])

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
      {isLoading && posts.length === 0 ? (
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

          {/* Sentinel: when this scrolls into view we load the next page.
              Only mounted when there's more to load and we're on the
              unfiltered feed (the Following filter is client-side and
              can't cursor-paginate the same way). */}
          {hasMore && activeFilter !== "Following" && (
            <div ref={sentinelRef} className="t-feed-sentinel" aria-hidden="true" />
          )}

          {isLoadingMore && (
            <div className="t-feed-loading-more">
              <div
                className="animate-spin rounded-full"
                style={{ width: 24, height: 24, border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }}
              />
            </div>
          )}

          {!hasMore && <div className="t-feed-end">You're caught up.</div>}
        </div>
      )}

      {toast && <div className="t-toast" role="status">{toast}</div>}
    </div>
  )
}
