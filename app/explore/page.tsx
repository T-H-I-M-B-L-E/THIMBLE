"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ExplorePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/feed")
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-black" />
    </div>
  )
}
