"use client"

import { useState, useCallback, useEffect } from "react"
import type { Notification } from "@/lib/notifications"
import { getCached, setCached, fetchCached, subscribe } from "@/lib/swr-cache"

const notificationsKey = (userId: string) => `notifications:${userId}`

export function useNotifications(userId: string | undefined) {
  const key = userId ? notificationsKey(userId) : ""
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    key ? (getCached<Notification[]>(key) ?? []) : []
  )
  const [isLoading, setIsLoading] = useState(!key || notifications.length === 0)

  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchCached(key, async () => {
      const res = await fetch(`/api/notifications?userId=${userId}`, {
        credentials: "include",
      })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    })
      .then(v => setNotifications(v))
      .catch(() => setNotifications([]))
      .finally(() => setIsLoading(false))
  }, [key, userId])

  // Stay in sync when other consumers update cache
  useEffect(() => {
    if (!key) return
    return subscribe(key, () => {
      const v = getCached<Notification[]>(key)
      if (v) setNotifications(v)
    })
  }, [key])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return
      const updated = notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
      setNotifications(updated)
      setCached(key, updated)

      try {
        await fetch(`/api/notifications/${notificationId}/read`, {
          method: "PATCH",
          credentials: "include",
        })
      } catch {
        // Revert on error
        setNotifications(notifications)
        setCached(key, notifications)
      }
    },
    [notifications, key, userId]
  )

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, isLoading, markAsRead, unreadCount }
}
