"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, Home, Grid3X3, User } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
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
  /** Override the centered label (defaults to the active item's label) */
  pageLabel?: string
}

const DEFAULT_ITEMS: PillNavItem[] = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/explore", icon: Grid3X3, label: "Explore" },
  { href: "/profile", icon: User, label: "Profile" },
]

/**
 * Floating premium pill nav.
 *
 * Geometry: 2 icons | center column (label, animated) | 2 icons,
 * with an elevated FAB anchored to the pill's geometric center.
 * Items beyond the first 4 are dropped so the layout stays symmetric
 * and fits the smallest target (iPhone SE 375px).
 */
export function BottomNav({
  items = DEFAULT_ITEMS,
  onCreate,
  createLabel = "Create",
  pageLabel,
}: BottomPillNavProps) {
  const pathname = usePathname() || ""

  const isActive = (item: PillNavItem) => {
    if (item.match) return item.match(pathname)
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + "/")
  }

  // Always cap to 4 for a clean, symmetric 2+2 layout around the FAB.
  const capped = items.slice(0, 4)
  const left = capped.slice(0, 2)
  const right = capped.slice(2, 4)

  // Label resolves from the active item across the *full* item list,
  // not the capped one, so dropped items still surface their page name.
  const activeItem = items.find(isActive)
  const label = pageLabel ?? activeItem?.label ?? ""

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
        <Icon size={20} />
      </Link>
    )
  }

  return (
    <nav className="t-bottomnav" aria-label="Primary">
      <div className="t-bn-pill">
        <div className="t-bn-side">{left.map(renderIcon)}</div>

        <div className="t-bn-center">
          <div className="t-bn-label" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={label}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="t-bn-side">{right.map(renderIcon)}</div>

        {/* FAB is a direct child of the pill so it lands on the
            pill's geometric center, regardless of label width. */}
        {onCreate && (
          <button
            className="t-bn-fab"
            type="button"
            onClick={onCreate}
            aria-label={createLabel}
          >
            <Plus size={24} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </nav>
  )
}
