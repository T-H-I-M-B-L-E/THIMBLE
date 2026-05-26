"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useNotify } from "@/components/notify-provider"
import { Input } from "@/components/ui/input"
import { Search, MapPin, DollarSign, Calendar } from "lucide-react"
import { useState, useEffect } from "react"
import Image from "next/image"

export default function GigsPage() {
  const { user, gigs: fallbackGigs } = useStore()
  const notify = useNotify()
  const [gigs, setGigs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [applyingId, setApplyingId] = useState<number | null>(null)
  const isVerified = user?.verificationStatus === "verified"

  useEffect(() => {
    fetchGigs()
  }, [])

  const fetchGigs = async () => {
    try {
      const res = await fetch("/api/gigs", { credentials: "include" })
      const data = await res.json()
      setGigs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to fetch gigs:", err)
      setGigs(fallbackGigs)
    } finally {
      setIsLoading(false)
    }
  }

  const apply = async (gig: any) => {
    if (gig.hasApplied || applyingId === gig.id) return
    setApplyingId(gig.id)
    // Optimistic update so the button reflects the new state instantly.
    setGigs(prev => prev.map(g => g.id === gig.id ? { ...g, hasApplied: true, applications: g.applications + 1 } : g))
    try {
      const res = await fetch(`/api/gigs/${gig.id}/apply`, { method: "POST", credentials: "include" })
      if (!res.ok) {
        // Roll back.
        setGigs(prev => prev.map(g => g.id === gig.id ? { ...g, hasApplied: false, applications: Math.max(0, g.applications - 1) } : g))
        const data = await res.json().catch(() => ({}))
        notify.error(data?.message || "Could not apply. Try again.")
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data?.already) {
        notify.success("You've already applied to this gig.")
      } else {
        notify.success("Application sent.")
      }
    } finally {
      setApplyingId(null)
    }
  }

  const filteredGigs = gigs.filter(gig =>
    gig.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gig.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto" }}>
        <div style={{ marginBottom: "20px" }}>
          <h1 className="t-page-title">Marketplace</h1>
          <p className="t-page-sub">
            {isVerified
              ? "Browse and apply to live creative opportunities."
              : "Complete verification to unlock gig applications."}
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
          </div>
        ) : (
          <>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "var(--t-ink-3)" }} />
              <Input
                placeholder="Search gigs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: "36px",
                  borderRadius: "9px",
                  border: "1px solid var(--t-line)",
                  background: "var(--t-surface)",
                  color: "var(--t-ink)"
                }}
              />
            </div>

            {/* Gigs List */}
            <div className="t-gigs-list">
              {filteredGigs.map((gig) => (
                <div key={gig.id} className="t-gig-card">
                  {gig.postedByAvatar && (
                    <Image
                      src={gig.postedByAvatar}
                      alt={gig.postedBy}
                      width={48}
                      height={48}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                  )}

                  <div className="t-gig-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div>
                        <div className="t-gig-title">{gig.title}</div>
                        <div className="t-muted-xs" style={{ marginTop: "2px" }}>
                          {gig.postedBy} · posted {gig.date}
                        </div>
                      </div>
                    </div>

                    <div className="t-gig-facts">
                      <span>
                        <MapPin size={14} />
                        {gig.location}
                      </span>
                      <span>
                        <DollarSign size={14} />
                        {gig.payment}
                      </span>
                      <span>
                        <Calendar size={14} />
                        {gig.date}
                      </span>
                      <span style={{ color: "var(--t-ink-3)" }}>·</span>
                      <span className="t-muted-xs">{gig.applications} applied</span>
                    </div>

                    <div className="t-gig-actions">
                      <button
                        className="t-btn-primary t-btn-sm"
                        disabled={!isVerified || gig.hasApplied || applyingId === gig.id}
                        onClick={() => apply(gig)}
                      >
                        {!isVerified ? "Verify to Apply"
                          : gig.hasApplied ? "Applied"
                          : applyingId === gig.id ? "Applying…"
                          : "Apply"}
                      </button>
                      <button
                        className="t-btn-quiet t-btn-sm"
                        style={{ cursor: "pointer" }}
                      >
                        Save for later
                      </button>
                      <button
                        className="t-btn-quiet t-btn-sm"
                        style={{ cursor: "pointer" }}
                      >
                        Message
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredGigs.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--t-ink-2)" }}>
                  <p>No gigs found matching your search</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
