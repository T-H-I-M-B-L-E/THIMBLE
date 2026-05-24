"use client"

import { useState, useCallback, useEffect } from "react"
import {
  getCached,
  setCached,
  fetchCached,
  prefetch,
  subscribe,
  isFresh,
} from "@/lib/swr-cache"

export interface Comment {
  id: number | string
  userId: string
  userName: string
  userAvatar?: string
  userVerified?: boolean
  content: string
  createdAt: string
}

export interface FollowingUser {
  userId: string
  userName: string
  userAvatar?: string
  role?: string
}

// ── Likes ────────────────────────────────────────────────────────────────────

export function useLike(postId: string | number, initialCount: number, initialLiked = false) {
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(initialLiked)
  const [pending, setPending] = useState(false)

  const toggle = useCallback(async () => {
    if (pending) return
    setLiked(prev => !prev)
    setCount(prev => liked ? prev - 1 : prev + 1)
    setPending(true)
    try {
      const res = await fetch(`/api/posts/${postId}/likes`, {
        method: liked ? 'DELETE' : 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setLiked(prev => !prev)
      setCount(prev => liked ? prev + 1 : prev - 1)
    } finally {
      setPending(false)
    }
  }, [postId, liked, pending])

  return { count, liked, toggle, pending }
}

// ── Comments ─────────────────────────────────────────────────────────────────

const commentsKey = (postId: string | number) => `comments:${postId}`

const commentsFetcher = (postId: string | number) => async (): Promise<Comment[]> => {
  const res = await fetch(`/api/posts/${postId}/comments`, { credentials: 'include' })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/**
 * Warm the comments cache for a post. Safe to call from hover / pointerdown
 * on the comment button — by the time the click registers, the data is
 * usually already cached, so the panel opens with zero perceptible latency.
 */
export function prefetchComments(postId: string | number): void {
  prefetch(commentsKey(postId), commentsFetcher(postId))
}

export function useComments(postId: string | number, initialCount = 0) {
  const key = commentsKey(postId)

  // Seed from cache so reopening a previously-viewed thread is instant.
  const [comments, setComments] = useState<Comment[]>(() => getCached<Comment[]>(key) ?? [])
  const [count, setCount] = useState<number>(() => {
    const cached = getCached<Comment[]>(key)
    return cached ? cached.length : initialCount
  })
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Stay in sync if another consumer of the same post updates the cache.
  useEffect(() => {
    return subscribe(key, () => {
      const v = getCached<Comment[]>(key)
      if (v) {
        setComments(v)
        setCount(v.length)
      }
    })
  }, [key])

  const open = useCallback(() => {
    setIsOpen(true)
    if (isFresh(key)) return // cached data is already on screen

    setIsLoading(true)
    fetchCached(key, commentsFetcher(postId)).finally(() => setIsLoading(false))
  }, [key, postId])

  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => {
    setIsOpen(prev => {
      if (!prev && !isFresh(key)) {
        setIsLoading(true)
        fetchCached(key, commentsFetcher(postId)).finally(() => setIsLoading(false))
      }
      return !prev
    })
  }, [key, postId])

  const addComment = useCallback(async (content: string): Promise<boolean> => {
    const trimmed = content.trim()
    if (!trimmed) return false
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: trimmed }),
      })
      if (!res.ok) return false
      const newComment: Comment = await res.json()
      const existing = getCached<Comment[]>(key) ?? []
      setCached(key, [...existing, newComment])
      return true
    } catch {
      return false
    }
  }, [key, postId])

  const deleteComment = useCallback(async (commentId: number | string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) return false
      const existing = getCached<Comment[]>(key) ?? []
      setCached(key, existing.filter(c => String(c.id) !== String(commentId)))
      return true
    } catch {
      return false
    }
  }, [key, postId])

  return { comments, isLoading, isOpen, count, open, toggle, close, addComment, deleteComment }
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

export function useBookmark(postId: string | number, initialSaved = false) {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)

  const toggle = useCallback(async () => {
    if (pending) return
    const next = !saved
    setSaved(next)
    setPending(true)
    try {
      const res = await fetch(`/api/posts/${postId}/saves`, {
        method: next ? 'POST' : 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setSaved(!next)
    } finally {
      setPending(false)
    }
  }, [postId, saved, pending])

  return { saved, toggle, pending }
}

// ── Follow ───────────────────────────────────────────────────────────────────

const followKey = (currentId: string, targetId: string) =>
  `follow:${currentId}:${targetId}`

export function useFollow(targetUserId: string | undefined, currentUserId: string | undefined) {
  const isSelf = !!currentUserId && currentUserId === targetUserId
  const key = currentUserId && targetUserId ? followKey(currentUserId, targetUserId) : ""

  // Seed from cache when we have a stored answer — skips the spinner entirely
  // for users you've already seen this session.
  const cached = key ? getCached<boolean>(key) : undefined
  const [isFollowing, setIsFollowing] = useState<boolean>(cached ?? false)
  const [isChecking, setIsChecking] = useState<boolean>(cached === undefined && !isSelf && !!key)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!targetUserId || !currentUserId || isSelf) {
      setIsChecking(false)
      return
    }
    if (isFresh(key)) {
      const v = getCached<boolean>(key)
      if (v !== undefined) setIsFollowing(v)
      setIsChecking(false)
      return
    }
    setIsChecking(true)
    fetchCached(key, async () => {
      const r = await fetch(
        `/api/follows?followerId=${currentUserId}&followingId=${targetUserId}`,
        { credentials: 'include' }
      )
      const data = await r.json().catch(() => ({}))
      return !!data?.isFollowing
    })
      .then(v => setIsFollowing(v))
      .catch(() => {})
      .finally(() => setIsChecking(false))
  }, [key, targetUserId, currentUserId, isSelf])

  // Mirror cache → local state if it changes elsewhere (e.g. another card).
  useEffect(() => {
    if (!key) return
    return subscribe(key, () => {
      const v = getCached<boolean>(key)
      if (v !== undefined) setIsFollowing(v)
    })
  }, [key])

  const toggle = useCallback(async () => {
    if (!targetUserId || pending || isSelf) return
    const next = !isFollowing
    setIsFollowing(next)
    setCached(key, next)
    setPending(true)
    try {
      const res = await fetch('/api/follows', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ followingId: targetUserId }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setIsFollowing(!next)
      setCached(key, !next)
    } finally {
      setPending(false)
    }
  }, [key, targetUserId, isFollowing, pending, isSelf])

  return { isFollowing, isChecking, isSelf, toggle, pending }
}

// ── Following list (for messaging user discovery) ────────────────────────────

export function useFollowing(currentUserId: string | undefined) {
  const key = currentUserId ? `following:${currentUserId}` : ""
  const [following, setFollowing] = useState<FollowingUser[]>(() =>
    key ? (getCached<FollowingUser[]>(key) ?? []) : []
  )
  const [isLoading, setIsLoading] = useState<boolean>(
    !!currentUserId && !isFresh(key)
  )

  useEffect(() => {
    if (!currentUserId) { setIsLoading(false); return }
    if (isFresh(key)) {
      const v = getCached<FollowingUser[]>(key)
      if (v) setFollowing(v)
      setIsLoading(false)
      return
    }
    fetchCached(key, async () => {
      const r = await fetch(
        `/api/follows?followerId=${currentUserId}&type=following`,
        { credentials: 'include' }
      )
      const data = await r.json().catch(() => [])
      return Array.isArray(data) ? data : []
    })
      .then(v => setFollowing(v))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [key, currentUserId])

  useEffect(() => {
    if (!key) return
    return subscribe(key, () => {
      const v = getCached<FollowingUser[]>(key)
      if (v) setFollowing(v)
    })
  }, [key])

  return { following, isLoading }
}
