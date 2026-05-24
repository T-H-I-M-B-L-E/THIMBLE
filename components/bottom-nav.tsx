"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, Home, Grid3X3, User } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PillNavItem {
  href: string
  icon: React.ComponentType<{ size?: number }>
  label: string
  exact?: boolean
  match?: (pathname: string) => boolean
}

interface BottomPillNavProps {
  items?: PillNavItem[]
  onCreate?: () => void
  createLabel?: string
}

const DEFAULT_ITEMS: PillNavItem[] = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/explore", icon: Grid3X3, label: "Explore" },
  { href: "/profile", icon: User, label: "Profile" },
]

/**
 * Floating slim pill nav. Layout: 2 icons | Post button | 2 icons.
 * Post button is inline (not a floating FAB) so it aligns with the
 * other items while still standing out via dark fill.
 */
export function BottomNav({
  items = DEFAULT_ITEMS,
  onCreate,
  createLabel = "Create",
}: BottomPillNavProps) {
  const pathname = usePathname() || ""

  const isActive = (item: PillNavItem) => {
    if (item.match) return item.match(pathname)
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + "/")
  }

  const capped = items.slice(0, 4)
  const left = capped.slice(0, 2)
  const right = capped.slice(2, 4)

  const renderIcon = (item: PillNavItem) => {
    const Icon = item.icon
    const active = isActive(item)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn("t-bn-btn", active && "active")}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
      >
        <Icon size={18} />
      </Link>
    )
  }

  return (
    <nav className="t-bottomnav" aria-label="Primary">
      <div className="t-bn-pill">
        <div className="t-bn-side">{left.map(renderIcon)}</div>

        {onCreate ? (
          <button
            className="t-bn-post"
            type="button"
            onClick={onCreate}
            aria-label={createLabel}
          >
            <Plus size={16} strokeWidth={2.4} />
            <span>Post</span>
          </button>
        ) : (
          <div className="t-bn-center" aria-hidden="true" />
        )}

        <div className="t-bn-side">{right.map(renderIcon)}</div>
      </div>
    </nav>
  )
}
