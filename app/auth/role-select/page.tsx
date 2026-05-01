"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RoleSelectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/onboarding")
  }, [router])

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-black" />
    </div>
  )
}
