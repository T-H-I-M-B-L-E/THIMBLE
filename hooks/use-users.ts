"use client"

import { useState, useEffect, useCallback } from "react"

export interface UserSummary {
  id: string
  fullName: string
  avatarUrl?: string
  role?: string
  verificationStatus?: string
}

// Module-level cache so multiple consumers share one fetch.
let cache: UserSummary[] | null = null
let inflight: Promise<UserSummary[]> | null = null
const subscribers = new Set<(users: UserSummary[]) => void>()

async function fetchUsers(): Promise<UserSummary[]> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch("/api/users", { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      cache = Array.isArray(data) ? data : []
      subscribers.forEach(cb => cb(cache!))
      return cache
    } catch (err) {
      console.error("[useUsers] fetch failed", err)
      cache = []
      return cache
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Returns the full list of users (cached) plus a lookup helper.
 * Used by the post composer (tag picker) and the post card (resolve tag IDs → names).
 */
export function useUsers() {
  const [users, setUsers] = useState<UserSummary[]>(cache ?? [])
  const [isLoading, setIsLoading] = useState(!cache)

  useEffect(() => {
    if (cache) {
      setUsers(cache)
      setIsLoading(false)
      return
    }
    const sub = (list: UserSummary[]) => setUsers(list)
    subscribers.add(sub)
    fetchUsers().finally(() => setIsLoading(false))
    return () => { subscribers.delete(sub) }
  }, [])

  const lookup = useCallback(
    (id: string): UserSummary | undefined => users.find(u => u.id === id),
    [users]
  )

  return { users, isLoading, lookup }
}
