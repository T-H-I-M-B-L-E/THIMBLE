"use client"

import { useState, useCallback, useEffect } from "react"

export interface Comment {
  id: number | string
  userId: string
  userName: string
  userAvatar?: string
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
    // Optimistic update
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
      // Revert on error
      setLiked(prev => !prev)
      setCount(prev => liked ? prev + 1 : prev - 1)
    } finally {
      setPending(false)
    }
  }, [postId, liked, pending])

  return { count, liked, toggle, pending }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export function useComments(postId: string | number, initialCount = 0) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [fetched, setFetched] = useState(false)

  const fetchComments = useCallback(async () => {
    if (fetched) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const arr = Array.isArray(data) ? data : []
      setComments(arr)
      setCount(arr.length)
      setFetched(true)
    } finally {
      setIsLoading(false)
    }
  }, [postId, fetched])

  const open = useCallback(() => {
    setIsOpen(true)
    fetchComments()
  }, [fetchComments])

  const close = () => setIsOpen(false)
  const toggle = () => (isOpen ? close() : open())

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
      setComments(prev => [...prev, newComment])
      setCount(prev => prev + 1)
      return true
    } catch {
      return false
    }
  }, [postId])

  return { comments, isLoading, isOpen, count, toggle, close, addComment }
}

// ── Follow ────────────────────────────────────────────────────────────────────

export function useFollow(targetUserId: string | undefined, currentUserId: string | undefined) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [pending, setPending] = useState(false)

  // Skip self-follow check
  const isSelf = !!currentUserId && currentUserId === targetUserId

  useEffect(() => {
    if (!targetUserId || !currentUserId || isSelf) {
      setIsChecking(false)
      return
    }
    fetch(`/api/follows?followerId=${currentUserId}&followingId=${targetUserId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setIsFollowing(!!data?.isFollowing))
      .catch(() => {})
      .finally(() => setIsChecking(false))
  }, [targetUserId, currentUserId, isSelf])

  const toggle = useCallback(async () => {
    if (!targetUserId || pending || isSelf) return
    const next = !isFollowing
    setIsFollowing(next)
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
    } finally {
      setPending(false)
    }
  }, [targetUserId, isFollowing, pending, isSelf])

  return { isFollowing, isChecking, isSelf, toggle, pending }
}

// ── Following list (for messaging user discovery) ─────────────────────────────

export function useFollowing(currentUserId: string | undefined) {
  const [following, setFollowing] = useState<FollowingUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId) { setIsLoading(false); return }
    fetch(`/api/follows?followerId=${currentUserId}&type=following`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setFollowing(Array.isArray(data) ? data : []))
      .catch(() => setFollowing([]))
      .finally(() => setIsLoading(false))
  }, [currentUserId])

  return { following, isLoading }
}
