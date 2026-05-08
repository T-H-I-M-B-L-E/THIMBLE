"use client"

import { useAuth } from "@/lib/useAuth"
import { useEffect } from "react"
import { useStore, User, UserRole, VerificationStatus } from "@/lib/store"

export function UserSync() {
  const { user, isLoading } = useAuth()
  const { setUser, isAuthenticated, setHasSeenWelcome } = useStore()

  useEffect(() => {
    if (isLoading) return

    if (user) {
      if (!isAuthenticated) {
        setHasSeenWelcome(false)
      }

      // Map API user to Zustand User type
      const userData: User = {
        id: user.id,
        fullName: user.fullName || user.full_name || "",
        email: user.email,
        phone: user.phone || "",
        role: (user.role as UserRole) ?? null,
        avatar: user.avatar || user.avatar_url,
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        verificationStatus: (user.verificationStatus || user.verification_status as VerificationStatus) ?? "unverified",
        followers: user.followers ?? 0,
        following: user.following ?? 0,
        posts: user.posts ?? 0,
      }
      setUser(userData)
    } else {
      setUser(null)
    }
  }, [user, isLoading, isAuthenticated, setUser, setHasSeenWelcome])

  return null
}
