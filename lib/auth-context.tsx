"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export interface User {
  id: string
  email: string
  name: string
  username: string
  avatar?: string
  role?: string
  bio?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("atelier_user")
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        console.error("Failed to parse stored user:", error)
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Demo: Accept any email/password combo, create user object
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        name: email.split("@")[0],
        username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
        avatar: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? "1534528741775-53994a69daeb" : "1507003211169-0a1dd7228f2d"}?w=100&h=100&fit=crop`,
        role: "Creative",
      }

      setUser(newUser)
      localStorage.setItem("atelier_user", JSON.stringify(newUser))
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (name: string, username: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        name,
        username: username.toLowerCase().replace(/[^a-z0-9]/g, ""),
        avatar: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? "1534528741775-53994a69daeb" : "1507003211169-0a1dd7228f2d"}?w=100&h=100&fit=crop`,
        role: "Creative",
        bio: "",
      }

      setUser(newUser)
      localStorage.setItem("atelier_user", JSON.stringify(newUser))
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("atelier_user")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
