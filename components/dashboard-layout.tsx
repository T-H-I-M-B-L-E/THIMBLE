"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/useAuth"
import { VerificationBanner } from "./verification-banner"
import { BanWall } from "./ban-wall"
import { CreatePostModal } from "./create-post-modal"
import { BottomNav } from "./bottom-nav"
import { NotificationCenter } from "./notification-center"
import { SearchBar } from "./search-bar"
import { useState, useEffect, useRef } from "react"
import { Home, Briefcase, MessageSquare, User, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { RightRail } from "./right-rail"

interface DashboardLayoutProps {
  children: React.ReactNode
  /** Optional now — role is derived from useAuth(). Kept for back-compat. */
  role?: string
  showRail?: boolean
  fullBleed?: boolean
}

export function DashboardLayout({ children, role: roleProp, showRail = false, fullBleed = false }: DashboardLayoutProps) {
  const router = useRouter()
  const { user } = useStore()
  const { user: authUser, logout } = useAuth()
  const role = roleProp || authUser?.role || "designer"
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleCreate = () => {
    const event = new CustomEvent("thimble:request-compose", { cancelable: true })
    window.dispatchEvent(event)
    if (!event.defaultPrevented) setCreatePostOpen(true)
  }

  // Close the avatar menu on outside click or escape.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    await logout()
    router.push("/auth")
  }

  // Pill nav holds 4 destinations max for a symmetric premium layout.
  // The dashboard root ("Explore") is still reachable via the brand logo.
  const navItems = [
    { href: `/feed`, icon: Home, label: "Home" },
    { href: `/gigs`, icon: Briefcase, label: "Gigs" },
    { href: `/messages`, icon: MessageSquare, label: "Messages" },
    { href: `/profile`, icon: User, label: "Profile" },
  ]

  if (user?.isBanned) {
    return <BanWall bannedUntil={user.bannedUntil} banMessage={user.banMessage} />
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Floating glass top bar */}
      <header className="t-topbar">
        <div className="t-topbar-inner">
          <Link href="/" className="t-brand" aria-label="Tvimble home">
            <span className="t-brand-mark" aria-hidden="true" />
            <span className="t-brand-name">TVIMBLE</span>
          </Link>
          <SearchBar role={role} />
          <div className="t-topbar-right">
            <NotificationCenter userId={user?.id} />

            {/* Avatar opens a small menu — Profile / Settings / Logout */}
            <div className="t-avatar-menu" ref={menuRef}>
              <button
                type="button"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
                className="t-avatar-trigger"
              >
                {user?.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.fullName || "Me"}
                    width={32}
                    height={32}
                    className="t-topbar-avatar"
                  />
                ) : (
                  <div className="t-topbar-avatar t-avatar-ph">
                    {user?.fullName?.[0] ?? "U"}
                  </div>
                )}
              </button>

              {menuOpen && (
                <div role="menu" className="t-avatar-dropdown">
                  <button
                    role="menuitem"
                    className="t-avatar-dropdown-item"
                    onClick={() => { setMenuOpen(false); router.push(`/profile`) }}
                  >
                    <User size={15} />
                    Profile
                  </button>
                  <button
                    role="menuitem"
                    className="t-avatar-dropdown-item"
                    onClick={() => { setMenuOpen(false); router.push(`/settings`) }}
                  >
                    <Settings size={15} />
                    Settings
                  </button>
                  <div className="t-avatar-dropdown-divider" />
                  <button
                    role="menuitem"
                    className="t-avatar-dropdown-item t-avatar-dropdown-danger"
                    onClick={() => { setMenuOpen(false); void handleLogout() }}
                  >
                    <LogOut size={15} />
                    Log out
                  </button>
                </div>
              )}
            </div>
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
