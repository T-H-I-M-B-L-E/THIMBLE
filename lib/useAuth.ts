'use client'

import { useState, useEffect, useCallback } from 'react'
import { User } from '@/lib/store'

interface AuthHook {
  user: User | null
  isLoading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()

    // Re-fetch when the tab regains focus — picks up role/ban changes without polling
    window.addEventListener('focus', fetchUser)
    return () => {
      window.removeEventListener('focus', fetchUser)
    }
  }, [fetchUser])

  const logout = async () => {
    setUser(null)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Failed to clear server session:', error)
    }
  }

  return { user, isLoading, logout, refresh: fetchUser }
}
