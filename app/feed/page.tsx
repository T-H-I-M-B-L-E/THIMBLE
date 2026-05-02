"use client"

import { FeedView } from "@/components/feed-view"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { getDashboardFeedPath } from "@/lib/platform"

export default function FeedPage() {
  const { user: storeUser } = useStore()

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 glass">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-heading font-light tracking-[0.2em]">
            THIMBLE
          </Link>
          <div className="flex items-center gap-3">
            {storeUser ? (
              <Link href={getDashboardFeedPath(storeUser.role)} className="relative w-8 h-8 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-800">
                <Image
                  src={storeUser.avatar || "/placeholder-avatar.png"}
                  alt={storeUser.fullName || "User"}
                  fill
                  className="object-cover"
                />
              </Link>
            ) : (
              <Link href="/auth/signup">
                <Button size="sm" className="rounded-none bg-black text-white">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="max-w-2xl mx-auto py-8">
        <FeedView />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-black/95 backdrop-blur-sm lg:hidden">
        <div className="max-w-md mx-auto flex h-16 items-center justify-around">
          <Link href="/feed" className="flex flex-col items-center gap-1 p-2 text-black dark:text-white">
            <span className="text-[10px]">Feed</span>
          </Link>
          <Link href="/explore" className="flex flex-col items-center gap-1 p-2 text-neutral-400">
            <span className="text-[10px]">Explore</span>
          </Link>
          <Link href={storeUser?.role ? `/dashboard/${storeUser.role}/profile` : "/auth/signup"} className="flex flex-col items-center gap-1 p-2 text-neutral-400">
            <span className="text-[10px]">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
