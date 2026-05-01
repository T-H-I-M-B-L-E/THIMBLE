"use client"

import { useUser } from "@clerk/nextjs"
import { useEffect } from "react"
import { useStore, User } from "@/lib/store"

export function ClerkUserSync() {
  const { user, isLoaded } = useUser()
  const { setUser, isAuthenticated, setHasSeenWelcome } = useStore()

  useEffect(() => {
    if (isLoaded) {
      if (user) {
        // If we were not authenticated and now we are, show welcome
        if (!isAuthenticated) {
          setHasSeenWelcome(false)
        }
        
        const userData: User = {
          id: user.id,
          fullName: user.fullName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
          phone: "", // Clerk might not have phone unless collected
          role: (user.publicMetadata?.role as any) || (user.unsafeMetadata?.role as any) || null,
          avatar: (user.unsafeMetadata?.avatarUrl as string) || user.imageUrl,
          bio: (user.unsafeMetadata?.bio as string) || "",
          location: (user.unsafeMetadata?.location as string) || "",
          website: (user.unsafeMetadata?.website as string) || "",
          verificationStatus: (user.publicMetadata?.verificationStatus as any) || 'unverified',
          followers: (user.publicMetadata?.followers as number) || 0,
          following: (user.publicMetadata?.following as number) || 0,
          posts: (user.publicMetadata?.posts as number) || 0,
        }
        setUser(userData)
      } else {
        setUser(null)
      }
    }
  }, [user, isLoaded, setUser])

  return null
}
