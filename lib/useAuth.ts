'use client'

import { useState, useEffect } from 'react'
import { User } from '@/lib/store'

interface AuthHook {
  user: User | null
  isLoading: boolean
  logout: () => Promise<void>
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
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
    }

    fetchUser()

    // Re-fetch when the tab regains focus — picks up role/ban changes without polling
    const onFocus = () => fetchUser()
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const logout = async () => {
    // Always clear client-side state immediately (optimistic)
    setUser(null)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Failed to clear server session:', error)
      // User is already cleared client-side; they'll be redirected on next request
    }
  }

  return { user, isLoading, logout }
}
