"use client"

import { BottomNav } from "@/components/bottom-nav"
import { Home, Compass, Briefcase, MessageSquare, User } from "lucide-react"

export default function TestPage() {
  const items = [
    { href: "/test?p=home", icon: Home, label: "Home" },
    { href: "/test?p=explore", icon: Compass, label: "Explore" },
    { href: "/test?p=gigs", icon: Briefcase, label: "Gigs" },
    { href: "/test?p=messages", icon: MessageSquare, label: "Messages" },
    { href: "/test?p=profile", icon: User, label: "Profile" },
  ]

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px 200px" }}>
      <div className="glass" style={{ maxWidth: 640, margin: "0 auto", padding: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>
          Nav preview
        </h1>
        <p style={{ margin: "8px 0 0", color: "var(--t-ink-2)" }}>
          Premium pill nav at the bottom. FAB centered + elevated. Label inside the pill
          (currently inactive — no route matches “/test” in the items array, so it falls
          back to nothing).
        </p>
      </div>

      <BottomNav
        items={items}
        onCreate={() => alert("Create")}
        createLabel="Create"
      />
    </div>
  )
}
