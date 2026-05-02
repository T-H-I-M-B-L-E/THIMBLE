"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { getPostAuthPath } from "@/lib/platform"

export default function HomePage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      // Not signed in → go to auth
      router.push("/auth")
    } else {
      router.push(getPostAuthPath(user))
    }
  }, [user, isLoaded, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-black mx-auto mb-4"></div>
        <p className="text-neutral-500">Loading...</p>
      </div>
    </div>
  )
}
