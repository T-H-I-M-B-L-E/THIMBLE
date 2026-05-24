"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { VerificationBanner } from "./verification-banner"
import { BanWall } from "./ban-wall"
import { CreatePostModal } from "./create-post-modal"
import { BottomNav } from "./bottom-nav"
import { NotificationCenter } from "./notification-center"
import { useState } from "react"
import { Home, Briefcase, MessageSquare, User, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { RightRail } from "./right-rail"

interface DashboardLayoutProps {
  children: React.ReactNode
  role: string
  showRail?: boolean
  fullBleed?: boolean
}

export function DashboardLayout({ children, role, showRail = false, fullBleed = false }: DashboardLayoutProps) {
  const router = useRouter()
  const { user } = useStore()
  const [createPostOpen, setCreatePostOpen] = useState(false)

  const handleCreate = () => {
    const event = new CustomEvent("thimble:request-compose", { cancelable: true })
    window.dispatchEvent(event)
    if (!event.defaultPrevented) setCreatePostOpen(true)
  }

  // Pill nav holds 4 destinations max for a symmetric premium layout.
  // The dashboard root ("Explore") is still reachable via the brand logo.
  const navItems = [
    { href: `/dashboard/${role}/feed`, icon: Home, label: "Home" },
    { href: `/dashboard/${role}/gigs`, icon: Briefcase, label: "Gigs" },
    { href: `/dashboard/${role}/messages`, icon: MessageSquare, label: "Messages" },
    { href: `/dashboard/${role}/profile`, icon: User, label: "Profile" },
  ]

  if (user?.isBanned) {
    return <BanWall bannedUntil={user.bannedUntil} banMessage={user.banMessage} />
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Floating glass top bar */}
      <header className="t-topbar">
        <div className="t-topbar-inner">
          <Link href="/" className="t-brand" aria-label="Thimble home">
            <span className="t-brand-mark" aria-hidden="true" />
            <span className="t-brand-name">thimble</span>
          </Link>
          <div className="t-search" role="search">
            <Search className="t-search-ico" size={16} />
            <input placeholder="Search people, gigs, tags…" aria-label="Search" />
            <span className="t-search-kbd">⌘K</span>
          </div>
          <div className="t-topbar-right">
            <NotificationCenter userId={user?.id} />
            <button
              className="t-icon-btn"
              aria-label="Messages"
              type="button"
              onClick={() => router.push(`/dashboard/${role}/messages`)}
            >
              <MessageSquare size={18} />
            </button>
            <button
              className="t-btn-post"
              type="button"
              onClick={handleCreate}
            >
              <Plus size={16} />
              <span>Post</span>
            </button>
            {user?.avatar ? (
              <Image
                src={user.avatar}
                alt={user.fullName || "Me"}
                width={32}
                height={32}
                className="t-topbar-avatar"
                onClick={() => router.push(`/dashboard/${role}/profile`)}
              />
            ) : (
              <div
                className="t-topbar-avatar t-avatar-ph"
                onClick={() => router.push(`/dashboard/${role}/profile`)}
              >
                {user?.fullName?.[0] ?? "U"}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Shell — single column on mobile, +rail on wide desktop */}
      <div className={cn("t-shell", showRail && "has-rail", fullBleed && "t-shell--full-bleed")}>
        <main className={cn("t-main", fullBleed && "t-main--messages")}>
          {!fullBleed && <VerificationBanner />}
          {children}
        </main>
        {showRail && <RightRail />}
      </div>

      {/* Floating glass pill nav — always visible */}
      <BottomNav
        items={navItems}
        onCreate={handleCreate}
        createLabel="Create post"
      />

      <CreatePostModal
        isOpen={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onSuccess={() => setCreatePostOpen(false)}
        user={user}
      />
    </div>
  )
}
