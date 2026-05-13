"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/useAuth"
import { useStore } from "@/lib/store"
import { VerificationModal } from "./verification-modal"
import { VerificationBanner } from "./verification-banner"
import { BanWall } from "./ban-wall"
import { useState } from "react"
import { Home, Grid3X3, Briefcase, MessageSquare, User, Bell, Plus, Search, LogOut, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { RightRail } from "./right-rail"
import { CreatePostModal } from "./create-post-modal"

interface DashboardLayoutProps {
  children: React.ReactNode
  role: string
  showRail?: boolean
}

export function DashboardLayout({ children, role, showRail = false }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { logout: authLogout } = useAuth()
  const { user, logout } = useStore()
  const [showVerification, setShowVerification] = useState(false)
  const [createPostOpen, setCreatePostOpen] = useState(false)

  const handleLogout = async () => {
    logout()
    await authLogout()
    router.push("/auth")
  }

  const navItems = [
    { href: `/dashboard/${role}/feed`, icon: Home, label: "Home" },
    { href: `/dashboard/${role}`, icon: Grid3X3, label: "Explore", exact: true },
    { href: `/dashboard/${role}/gigs`, icon: Briefcase, label: "Gigs" },
    { href: `/dashboard/${role}/messages`, icon: MessageSquare, label: "Messages" },
    { href: `/dashboard/${role}/profile`, icon: User, label: "Profile" },
  ]

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  if (user?.isBanned) {
    return <BanWall bannedUntil={user.bannedUntil} banMessage={user.banMessage} />
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--t-bg)" }}>
      {/* Top bar */}
      <header className="t-topbar">
        <div className="t-topbar-inner">
          <Link href="/" className="t-brand">
            <span className="t-brand-mark" aria-hidden="true">◐</span>
            <span className="t-brand-name">thimble</span>
          </Link>
          <div className="t-search">
            <Search className="t-search-ico" size={16} />
            <input placeholder="Search people, gigs, tags…" />
            <span className="t-search-kbd">⌘K</span>
          </div>
          <div className="t-topbar-right">
            <button className="t-icon-btn" aria-label="Notifications">
              <Bell size={18} />
              <span className="t-dot" />
            </button>
            <button
              className="t-icon-btn"
              aria-label="Messages"
              onClick={() => router.push(`/dashboard/${role}/messages`)}
            >
              <MessageSquare size={18} />
            </button>
            <button className="t-btn-post" onClick={() => setCreatePostOpen(true)}>
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

      {/* Shell: sidenav | main | rail */}
      <div className={cn("t-shell", showRail && "has-rail")}>
        {/* Side nav */}
        <nav className="t-sidenav">
          <ul>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn("t-navlink", isActive(item.href, item.exact) && "active")}
                >
                  <span className="t-navlink-ic">
                    <item.icon size={18} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="t-sidenav-card">
            <div className="t-sidenav-card-row">
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.fullName || "User"}
                  width={40}
                  height={40}
                  className="t-avatar"
                />
              ) : (
                <div className="t-avatar t-avatar-ph">{user?.fullName?.[0] ?? "U"}</div>
              )}
              <div>
                <div className="t-sidenav-name">{user?.fullName}</div>
                <div className="t-sidenav-meta">{role}</div>
              </div>
            </div>
            {user?.verificationStatus !== "verified" && (
              <button
                className="t-btn-quiet t-block"
                onClick={() => setShowVerification(true)}
              >
                <Shield size={13} style={{ display: "inline", marginRight: 4 }} />
                Get verified
              </button>
            )}
            <button className="t-btn-quiet t-block" onClick={handleLogout}>
              <LogOut size={13} style={{ display: "inline", marginRight: 4 }} />
              Sign out
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="t-main">
          <VerificationBanner />
          {children}
        </main>

        {/* Right rail (conditionally shown) */}
        {showRail && <RightRail />}
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="t-bottomnav">
        {navItems.slice(0, 2).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn("t-bn-btn", isActive(item.href, item.exact) && "active")}
            aria-label={item.label}
          >
            <item.icon size={20} />
          </Link>
        ))}
        <button
          className="t-bn-post"
          aria-label="Create post"
          onClick={() => setCreatePostOpen(true)}
        >
          <Plus size={22} />
        </button>
        {navItems.slice(2).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn("t-bn-btn", isActive(item.href, item.exact) && "active")}
            aria-label={item.label}
          >
            <item.icon size={20} />
          </Link>
        ))}
      </nav>

      <VerificationModal isOpen={showVerification} onClose={() => setShowVerification(false)} />
      <CreatePostModal
        isOpen={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onSuccess={() => setCreatePostOpen(false)}
        user={user}
      />
    </div>
  )
}
