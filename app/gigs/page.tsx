"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useNotify } from "@/components/notify-provider"
import { Search, MapPin, DollarSign, Users, Plus, X, ChevronDown, Trash2, CheckCircle } from "lucide-react"
import { useState, useEffect, useCallback } from "react"

const ROLES = ["designer", "model", "manufacturer", "photographer", "brand"]

interface Gig {
  id: number
  title: string
  description: string
  location: string
  payment: string
  roleWanted: string
  status: string
  postedBy: string
  postedByRole: string
  postedByAvatar: string
  posterId: string
  applications: number
  hasApplied: boolean
  isOwner: boolean
  createdAt: string
}

interface Applicant {
  userId: string
  name: string
  avatar: string
  role: string
  appliedAt: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--t-surface)", border: "1px solid var(--t-line)",
  borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--t-ink)",
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
}

export default function GigsPage() {
  const { user } = useStore()
  const notify = useNotify()
  const isVerified = user?.verificationStatus === "verified" || user?.isVerified

  const [gigs, setGigs] = useState<Gig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [applyingId, setApplyingId] = useState<number | null>(null)

  // Create gig modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", location: "", payment: "", roleWanted: "" })

  // Applicants drawer
  const [applicantsGig, setApplicantsGig] = useState<Gig | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loadingApplicants, setLoadingApplicants] = useState(false)

  const fetchGigs = useCallback(async () => {
    try {
      const res = await fetch("/api/gigs", { credentials: "include" })
      const data = await res.json()
      setGigs(Array.isArray(data) ? data : [])
    } catch {
      setGigs([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchGigs() }, [fetchGigs])

  const apply = async (gig: Gig) => {
    if (gig.hasApplied || applyingId === gig.id) return
    setApplyingId(gig.id)
    setGigs(prev => prev.map(g => g.id === gig.id ? { ...g, hasApplied: true, applications: g.applications + 1 } : g))
    try {
      const res = await fetch(`/api/gigs/${gig.id}/apply`, { method: "POST", credentials: "include" })
      if (!res.ok) {
        setGigs(prev => prev.map(g => g.id === gig.id ? { ...g, hasApplied: false, applications: Math.max(0, g.applications - 1) } : g))
        const data = await res.json().catch(() => ({}))
        notify.error(data?.message || "Could not apply.")
      } else {
        notify.success("Application sent!")
      }
    } finally {
      setApplyingId(null)
    }
  }

  const createGig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/gigs", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        notify.error(err.error || "Failed to post gig")
        return
      }
      const gig = await res.json()
      setGigs(prev => [gig, ...prev])
      setShowCreate(false)
      setForm({ title: "", description: "", location: "", payment: "", roleWanted: "" })
      notify.success("Gig posted!")
    } finally {
      setCreating(false)
    }
  }

  const closeGig = async (gig: Gig) => {
    const ok = await notify.confirm({ title: "Close this gig?", message: "It will be hidden from the feed.", confirmLabel: "Close Gig", destructive: true })
    if (!ok) return
    const res = await fetch(`/api/gigs/${gig.id}/close`, { method: "PATCH", credentials: "include" })
    if (res.ok) {
      setGigs(prev => prev.filter(g => g.id !== gig.id))
      notify.success("Gig closed.")
    }
  }

  const deleteGig = async (gig: Gig) => {
    const ok = await notify.confirm({ title: "Delete this gig?", message: "This cannot be undone.", confirmLabel: "Delete", destructive: true })
    if (!ok) return
    const res = await fetch(`/api/gigs/${gig.id}`, { method: "DELETE", credentials: "include" })
    if (res.ok) {
      setGigs(prev => prev.filter(g => g.id !== gig.id))
      notify.success("Gig deleted.")
    }
  }

  const openApplicants = async (gig: Gig) => {
    setApplicantsGig(gig)
    setLoadingApplicants(true)
    try {
      const res = await fetch(`/api/gigs/${gig.id}/applicants`, { credentials: "include" })
      const data = await res.json().catch(() => [])
      setApplicants(Array.isArray(data) ? data : [])
    } finally {
      setLoadingApplicants(false)
    }
  }

  const filtered = gigs.filter(g => {
    const q = search.toLowerCase()
    const matchesSearch = !q || g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q) || g.location.toLowerCase().includes(q)
    const matchesRole = !roleFilter || g.roleWanted === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860, width: "100%", margin: "0 auto", padding: "0 0 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, paddingTop: 8 }}>
          <div>
            <h1 className="t-page-title" style={{ margin: 0 }}>Gigs</h1>
            <p className="t-page-sub" style={{ margin: "4px 0 0" }}>
              {isVerified ? "Browse and apply to live opportunities." : "Verify your account to apply to gigs."}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "var(--t-gold)", color: "#1a1400", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <Plus size={15} /> Post Gig
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t-ink-3)" }} size={15} />
            <input
              placeholder="Search gigs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ ...inputStyle, width: "auto", paddingRight: 30, cursor: "pointer", appearance: "none" }}
            >
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--t-ink-3)" }} />
          </div>
        </div>

        {/* Gig list */}
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 16px", color: "var(--t-ink-3)" }}>
            {gigs.length === 0 ? "No gigs yet — be the first to post one." : "No gigs match your search."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map(gig => (
              <div key={gig.id} style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  {gig.postedByAvatar && (
                    <img src={gig.postedByAvatar} alt={gig.postedBy} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{gig.title}</p>
                        <p style={{ fontSize: 12, color: "var(--t-ink-3)", margin: "2px 0 0" }}>
                          {gig.postedBy} · {gig.postedByRole} · {timeAgo(gig.createdAt)}
                        </p>
                      </div>
                      {gig.roleWanted && (
                        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--t-surface-2)", color: "var(--t-ink-3)", whiteSpace: "nowrap", flexShrink: 0, textTransform: "capitalize" }}>
                          {gig.roleWanted}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 13, color: "var(--t-ink-2)", margin: "10px 0", lineHeight: 1.5 }}>{gig.description}</p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "var(--t-ink-3)", marginBottom: 14 }}>
                      {gig.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} />{gig.location}</span>}
                      {gig.payment && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DollarSign size={13} />{gig.payment}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={13} />{gig.applications} applied</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {gig.isOwner ? (
                        <>
                          <button onClick={() => openApplicants(gig)} style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", background: "var(--t-gold)", color: "#1a1400", border: "none", borderRadius: 8, cursor: "pointer" }}>
                            View Applicants ({gig.applications})
                          </button>
                          <button onClick={() => closeGig(gig)} style={{ fontSize: 13, padding: "7px 14px", background: "transparent", color: "var(--t-ink-3)", border: "1px solid var(--t-line)", borderRadius: 8, cursor: "pointer" }}>
                            Close
                          </button>
                          <button onClick={() => deleteGig(gig)} style={{ fontSize: 13, padding: "7px 10px", background: "transparent", color: "var(--t-danger, #f0616d)", border: "1px solid rgba(240,97,109,0.3)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => apply(gig)}
                          disabled={!isVerified || gig.hasApplied || applyingId === gig.id}
                          style={{
                            fontSize: 13, fontWeight: 600, padding: "7px 16px", border: "none", borderRadius: 8, cursor: gig.hasApplied || !isVerified ? "default" : "pointer",
                            background: gig.hasApplied ? "rgba(63,207,142,0.12)" : isVerified ? "var(--t-ink)" : "var(--t-surface-2)",
                            color: gig.hasApplied ? "#3fcf8e" : isVerified ? "var(--t-bg)" : "var(--t-ink-3)",
                            display: "flex", alignItems: "center", gap: 5,
                          }}
                        >
                          {gig.hasApplied && <CheckCircle size={13} />}
                          {!isVerified ? "Verify to apply" : gig.hasApplied ? "Applied" : applyingId === gig.id ? "Applying…" : "Apply"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Gig Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.6)" }} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div style={{ width: "100%", maxWidth: 520, background: "var(--t-surface)", border: "1px solid var(--t-line)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--t-line)" }}>
              <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>Post a Gig</p>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t-ink-3)", padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={createGig} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t-ink-3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Title *</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Lookbook Model Needed" required />
              </div>
              <div>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t-ink-3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Description</label>
                <textarea style={{ ...inputStyle, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's the opportunity?" rows={3} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t-ink-3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Location</label>
                  <input style={inputStyle} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Lagos / Remote" />
                </div>
                <div>
                  <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t-ink-3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Payment</label>
                  <input style={inputStyle} value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))} placeholder="e.g. ₦50,000 / TBD" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t-ink-3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Looking for</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={form.roleWanted} onChange={e => setForm(f => ({ ...f, roleWanted: e.target.value }))}>
                  <option value="">Any role</option>
                  {ROLES.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid var(--t-line)", borderRadius: 8, fontSize: 14, color: "var(--t-ink-3)", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={creating || !form.title.trim()} style={{ flex: 2, padding: "10px", background: "var(--t-gold)", color: "#1a1400", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1 }}>
                  {creating ? "Posting…" : "Post Gig"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applicants Drawer */}
      {applicantsGig && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.5)" }} onClick={e => { if (e.target === e.currentTarget) setApplicantsGig(null) }}>
          <div style={{ width: "100%", maxWidth: 380, background: "var(--t-surface)", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--t-line)", position: "sticky", top: 0, background: "var(--t-surface)" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>Applicants</p>
                <p style={{ fontSize: 12, color: "var(--t-ink-3)", margin: "2px 0 0" }}>{applicantsGig.title}</p>
              </div>
              <button onClick={() => setApplicantsGig(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t-ink-3)", padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, flex: 1 }}>
              {loadingApplicants ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
                  <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }} />
                </div>
              ) : applicants.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--t-ink-3)", fontSize: 14, paddingTop: 48 }}>No applicants yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {applicants.map(a => (
                    <div key={a.userId} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {a.avatar
                        ? <img src={a.avatar} alt={a.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--t-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, flexShrink: 0 }}>{a.name?.[0]?.toUpperCase()}</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{a.name}</p>
                        <p style={{ fontSize: 12, color: "var(--t-ink-3)", margin: "2px 0 0", textTransform: "capitalize" }}>{a.role} · {timeAgo(a.appliedAt)}</p>
                      </div>
                      <a href={`/profile/${a.userId}`} style={{ fontSize: 12, color: "var(--t-gold)", textDecoration: "none", whiteSpace: "nowrap" }}>View</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
