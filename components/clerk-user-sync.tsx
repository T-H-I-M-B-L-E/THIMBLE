"use client"

import { useUser } from "@clerk/nextjs"
import { useEffect } from "react"
import { useStore, User, UserRole, VerificationStatus } from "@/lib/store"

export function ClerkUserSync() {
  const { user, isLoaded } = useUser()
  const { setUser, isAuthenticated, setHasSeenWelcome } = useStore()

  useEffect(() => {
    if (!isLoaded) return

    if (user) {
      if (!isAuthenticated) {
        setHasSeenWelcome(false)
      }

      // publicMetadata is server-set only — safe to trust for role and verification.
      // unsafeMetadata is user-writable — only used for display/preference fields.
      const userData: User = {
        id: user.id,
        fullName: user.fullName || "",
        email: user.primaryEmailAddress?.emailAddress || "",
        phone: "",
        role: (user.publicMetadata?.role as UserRole) ?? null,
        avatar: (user.unsafeMetadata?.avatarUrl as string) || user.imageUrl,
        bio: (user.unsafeMetadata?.bio as string) || "",
        location: (user.unsafeMetadata?.location as string) || "",
        website: (user.unsafeMetadata?.website as string) || "",
        verificationStatus: (user.publicMetadata?.verificationStatus as VerificationStatus) ?? "unverified",
        followers: (user.publicMetadata?.followers as number) ?? 0,
        following: (user.publicMetadata?.following as number) ?? 0,
        posts: (user.publicMetadata?.posts as number) ?? 0,
      }
      setUser(userData)
    } else {
      setUser(null)
    }
  }, [user, isLoaded, isAuthenticated, setUser, setHasSeenWelcome])

  return null
}
