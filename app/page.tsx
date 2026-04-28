"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, user } = useStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth")
    } else if (user?.role) {
      router.push(`/dashboard/${user.role}`)
    } else {
      router.push("/auth/role-select")
    }
  }, [isAuthenticated, user, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-black mx-auto mb-4"></div>
        <p className="text-neutral-500">Loading...</p>
      </div>
    </div>
  )
}
