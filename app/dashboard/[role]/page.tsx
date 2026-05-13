"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ImageIcon, Briefcase, MessageSquare, Shield, Camera, Upload, Palette, Factory, Users, Bookmark, TrendingUp } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/useAuth"

export default function RoleDashboard() {
  const params = useParams()
  const role = params.role as string
  const { user: storeUser, gigs } = useStore()
  const { user } = useAuth()
  const isVerified = user?.verificationStatus === "verified"

  const [recentPosts, setRecentPosts] = useState<{ id: number | string; imageUrl: string; description: string }[]>([])

  useEffect(() => {
    fetch("/api/posts", { credentials: "include" })
      .then(r => r.json())
      .then(data => setRecentPosts(Array.isArray(data) ? data.slice(0, 6) : []))
      .catch(() => {})
  }, [])

  // Role-specific config
  const roleConfig = {
    model: {
      title: "Model",
      welcome: isVerified
        ? "Your profile is verified. You can now apply to gigs and post your portfolio."
        : "Complete verification to unlock all features and apply to gigs.",
      quickActions: [
        { icon: Camera, label: "Add Photos", disabled: false },
        { icon: Briefcase, label: "Find Gigs", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
        { icon: Users, label: "Network", disabled: false },
      ],
    },
    designer: {
      title: "Designer",
      welcome: isVerified
        ? "Your profile is verified. You can now post designs and find manufacturers."
        : "Complete verification to unlock posting features.",
      quickActions: [
        { icon: Upload, label: "Upload Design", disabled: !isVerified },
        { icon: TrendingUp, label: "Post Gig", disabled: !isVerified },
        { icon: Factory, label: "Find Manufacturers", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
      ],
    },
    manufacturer: {
      title: "Manufacturer",
      welcome: isVerified
        ? "Your profile is verified. You can now post services and receive orders."
        : "Complete verification to unlock manufacturing features.",
      quickActions: [
        { icon: TrendingUp, label: "Post Service", disabled: !isVerified },
        { icon: Palette, label: "Find Designs", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
        { icon: Bookmark, label: "Saved", disabled: false },
      ],
    },
    photographer: {
      title: "Photographer",
      welcome: isVerified
        ? "Your profile is verified. You can now showcase your work and find shoots."
        : "Complete verification to unlock all features.",
      quickActions: [
        { icon: Upload, label: "Upload Work", disabled: !isVerified },
        { icon: Briefcase, label: "Find Shoots", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
        { icon: Users, label: "Network", disabled: false },
      ],
    },
    brand: {
      title: "Brand",
      welcome: isVerified
        ? "Your brand is verified. You can now post campaigns and discover talent."
        : "Complete verification to unlock campaign posting features.",
      quickActions: [
        { icon: TrendingUp, label: "Post Campaign", disabled: !isVerified },
        { icon: Users, label: "Discover Talent", disabled: false },
        { icon: Bookmark, label: "Saved", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
      ],
    },
  }

  const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.model

  return (
    <DashboardLayout role={role} showRail={true}>
      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto" }}>
        {/* Welcome Section */}
        <div style={{ marginBottom: "24px" }}>
          <h1 className="t-page-title">Welcome back, {user?.fullName?.split(" ")[0] || "Creator"}</h1>
          <p className="t-page-sub">{config.welcome}</p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {config.quickActions.map((action, i) => {
            const Icon = action.icon
            return (
              <button
                key={i}
                disabled={action.disabled}
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  background: action.disabled ? "var(--t-surface-2)" : "var(--t-ink)",
                  color: action.disabled ? "var(--t-ink-3)" : "var(--t-bg)",
                  border: "1px solid var(--t-line)",
                  borderRadius: "9px",
                  cursor: action.disabled ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  opacity: action.disabled ? 0.6 : 1,
                  transition: "all .15s"
                }}
              >
                <Icon size={18} />
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>

        {/* Portfolio Grid */}
        <div style={{ marginBottom: "32px", padding: "16px", background: "var(--t-surface)", border: "1px solid var(--t-line)", borderRadius: "13px" }}>
          <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="t-page-title" style={{ margin: 0, fontSize: "18px" }}>
              <ImageIcon size={16} style={{ display: "inline", marginRight: "8px" }} />
              {role === "model" || role === "photographer" ? "Portfolio" : "Your Work"}
            </h2>
            <Link href={`/dashboard/${role}/feed`}>
              <button style={{ fontSize: "13px", color: "var(--t-gold-ink)", background: "none", border: 0, cursor: "pointer", fontWeight: 500 }}>
                View all
              </button>
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {recentPosts.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: "32px", textAlign: "center", color: "var(--t-ink-3)", fontSize: "13px" }}>
                No posts yet — go to the <Link href={`/dashboard/${role}/feed`} style={{ color: "var(--t-gold-ink)" }}>feed</Link> to explore or share your work.
              </div>
            ) : recentPosts.map((post) => (
              <div key={post.id} style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", borderRadius: "10px", background: "var(--t-surface-2)" }}>
                <Image
                  src={post.imageUrl}
                  alt={post.description}
                  fill
                  style={{ objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Available Gigs */}
        <div style={{ padding: "16px", background: "var(--t-surface)", border: "1px solid var(--t-line)", borderRadius: "13px" }}>
          <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="t-page-title" style={{ margin: 0, fontSize: "18px" }}>
              <Briefcase size={16} style={{ display: "inline", marginRight: "8px" }} />
              Available Gigs
            </h2>
            <Link href={`/dashboard/${role}/gigs`}>
              <button style={{ fontSize: "13px", color: "var(--t-gold-ink)", background: "none", border: 0, cursor: "pointer", fontWeight: 500 }}>
                View all
              </button>
            </Link>
          </div>
          <div className="t-gigs-list">
            {gigs.slice(0, 3).map((gig) => (
              <div key={gig.id} className="t-gig-card">
                {gig.postedByAvatar && (
                  <Image
                    src={gig.postedByAvatar}
                    alt={gig.postedBy}
                    width={40}
                    height={40}
                    style={{ borderRadius: "50%", objectFit: "cover" }}
                  />
                )}
                <div className="t-gig-body">
                  <div className="t-gig-title" style={{ fontSize: "14px" }}>{gig.title}</div>
                  <div className="t-muted-xs" style={{ marginTop: "1px" }}>
                    {gig.location} · {gig.payment}
                  </div>
                </div>
                <button
                  disabled={!isVerified}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    background: isVerified ? "var(--t-ink)" : "var(--t-surface-2)",
                    color: isVerified ? "var(--t-bg)" : "var(--t-ink-3)",
                    border: "1px solid var(--t-line)",
                    borderRadius: "7px",
                    cursor: isVerified ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                    fontWeight: 500,
                    opacity: isVerified ? 1 : 0.6,
                    whiteSpace: "nowrap"
                  }}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
