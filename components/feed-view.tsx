"use client"

import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/useAuth"
import { ImageIcon } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { PostCard } from "@/components/post-card"
import type { PostData } from "@/components/post-card"
import { AdPost } from "@/components/ad-post"
import type { AdData } from "@/components/ad-post"
import { InlineComposer } from "@/components/inline-composer"
import { useFollowing } from "@/hooks/use-social"
import { useInfinite } from "@/hooks/use-infinite"
import { useNotify } from "@/components/notify-provider"
import { getCached, setCached } from "@/lib/swr-cache"

const FEED_KEY = "feed:posts"

type FeedItem =
  | { type: "post"; data: PostData }
  | { type: "ad"; data: AdData }

export function FeedView() {
  const { user } = useAuth()
  const { removeDesignPost } = useStore()
  const [activeFilter, setActiveFilter] = useState("For you")
  const [toast, setToast] = useState<string | null>(null)
  const { following } = useFollowing(user?.id)
  const notify = useNotify()

  const fetchPage = useCallback(async (pageCursor: string | null) => {
    const url = pageCursor ? `/api/posts?before=${encodeURIComponent(pageCursor)}` : "/api/posts"
    const res = await fetch(url, { credentials: "include" })
    if (!res.ok) throw new Error("Failed to load")
    const data = await res.json()
    const arr: FeedItem[] = Array.isArray(data) ? data : []
    // Cursor is the id of the last post item (skip ads for cursor tracking)
    const lastPost = [...arr].reverse().find(i => i.type === "post")
    const postCount = arr.filter(i => i.type === "post").length
    return {
      items: arr,
      nextCursor: postCount === 20 && lastPost ? String((lastPost.data as PostData).id) : null,
    }
  }, [])

  const {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    sentinelRef,
    setItems,
  } = useInfinite<FeedItem>(fetchPage)

  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (seeded) return
    const cached = getCached<PostData[]>(FEED_KEY)
    if (cached && cached.length > 0) {
      setItems(cached.map(p => ({ type: "post" as const, data: p })))
    }
    setSeeded(true)
  }, [seeded, setItems])

  useEffect(() => {
    if (items.length === 0) return
    const posts = items.filter(i => i.type === "post").map(i => i.data as PostData)
    setCached(FEED_KEY, posts.slice(0, 20))
  }, [items])

  const visibleItems = (() => {
    if (activeFilter === "Following") {
      const followingIds = new Set(following.map(f => f.userId))
      return items.filter(i => {
        if (i.type === "ad") return false
        const p = i.data as PostData
        return p.userId && followingIds.has(p.userId) && p.userId !== user?.id
      })
    }
    return items
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
        setItems(prev => prev.filter(i => {
          if (i.type === "ad") return true
          return String((i.data as PostData).id) !== String(postId)
        }))
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
    setItems(prev => [{ type: "post", data: post }, ...prev])
    return String(post.id)
  }, [setItems])

  const commitOptimistic = useCallback((tempId: string, real: PostData) => {
    setItems(prev => prev.map(i => {
      if (i.type === "ad") return i
      return String((i.data as PostData).id) === tempId ? { type: "post", data: real } : i
    }))
  }, [setItems])

  const revertOptimistic = useCallback((tempId: string, error: string) => {
    if (tempId) {
      setItems(prev => prev.filter(i => {
        if (i.type === "ad") return true
        return String((i.data as PostData).id) !== tempId
      }))
    }
    setToast(error)
    setTimeout(() => setToast(null), 4000)
  }, [setItems])

  const filterTabs = ["For you", "Following", "Designers", "Models", "Photographers", "Brands"]

  return (
    <div className="t-feed">
      <InlineComposer
        user={user}
        onOptimistic={addOptimistic}
        onCommit={commitOptimistic}
        onRevert={revertOptimistic}
      />

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

      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="animate-spin rounded-full"
            style={{ width: 48, height: 48, border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }}
          />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="t-empty-state">
          <div className="t-empty-state-icon">
            <ImageIcon size={24} />
          </div>
          <h3>{activeFilter === "Following" ? "Nothing from people you follow yet" : "Nothing here yet"}</h3>
          <p>{activeFilter === "Following" ? "Follow people to see their posts here." : "Be the first to share — write something above."}</p>
        </div>
      ) : (
        <div className="t-feed-stream">
          {visibleItems.map((item, idx) =>
            item.type === "ad" ? (
              <AdPost key={`ad-${item.data.id}-${idx}`} ad={item.data as AdData} />
            ) : (
              <PostCard
                key={(item.data as PostData).id}
                post={item.data as PostData}
                currentUserId={user?.id}
                onDelete={handleDelete}
              />
            )
          )}

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
