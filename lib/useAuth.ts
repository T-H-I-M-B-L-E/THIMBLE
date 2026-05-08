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
    // Fetch user data from API route that reads the JWT cookie
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // Include cookies
        })

        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
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
