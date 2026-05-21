"use client"

import { FeedView } from "@/components/feed-view"
import { useStore } from "@/lib/store"
import { BottomNav } from "@/components/bottom-nav"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getDashboardFeedPath } from "@/lib/platform"
import { Home, Grid3X3, User } from "lucide-react"

export default function FeedPage() {
  const router = useRouter()
  const { user: storeUser } = useStore()

  const navItems = [
    { href: "/feed", icon: Home, label: "Feed" },
    { href: "/explore", icon: Grid3X3, label: "Explore" },
    {
      href: storeUser?.role ? `/dashboard/${storeUser.role}/profile` : "/auth/signup",
      icon: User,
      label: "Profile",
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Floating glass header */}
      <header className="t-topbar">
        <div className="t-topbar-inner">
          <Link href="/" className="t-brand" aria-label="Thimble home">
            <span className="t-brand-mark" aria-hidden="true" />
            <span className="t-brand-name">thimble</span>
          </Link>
          <div style={{ flex: 1 }} />
          <div className="t-topbar-right">
            {storeUser ? (
              <Link
                href={getDashboardFeedPath(storeUser.role)}
                className="t-topbar-avatar"
                style={{ position: "relative", display: "block", overflow: "hidden" }}
                aria-label="Open dashboard"
              >
                <Image
                  src={storeUser.avatar || "/placeholder-avatar.png"}
                  alt={storeUser.fullName || "User"}
                  fill
                  style={{ objectFit: "cover" }}
                />
              </Link>
            ) : (
              <Link href="/auth/signup" className="t-btn-post">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="t-shell">
        <div className="t-main">
          <FeedView />
        </div>
      </main>

      <BottomNav
        items={navItems}
        onCreate={() => router.push("/upload")}
        createLabel="New post"
      />
    </div>
  )
}
