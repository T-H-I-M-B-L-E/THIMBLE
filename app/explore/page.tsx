"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, BadgeCheck, Users, UserPlus } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/useAuth"
import { useNotify } from "@/components/notify-provider"
import { HowTo } from "@/components/how-to"

interface UserResult {
  id: string
  fullName: string
  username: string
  avatarUrl: string
  role: string
  isVerified: boolean
  followers: number
}

const ROLES = [
  { value: "", label: "Everyone" },
  { value: "designer", label: "Designers" },
  { value: "model", label: "Models" },
  { value: "photographer", label: "Photographers" },
  { value: "manufacturer", label: "Manufacturers" },
  { value: "brand", label: "Brands" },
]

export default function ExplorePage() {
  const { user } = useAuth()
  const notify = useNotify()
  const router = useRouter()

  const [q, setQ] = useState("")
  const [role, setRole] = useState("")
  const [results, setResults] = useState<UserResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [pendingFollow, setPendingFollow] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (query: string, roleFilter: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (roleFilter) params.set("role", roleFilter)
      const res = await fetch(`/api/users?${params.toString()}`, { credentials: "include" })
      if (!res.ok) throw new Error("fetch failed")
      const data = await res.json() as UserResult[]
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // load initial follows so buttons reflect current state
  useEffect(() => {
    if (!user?.id) return
    void (async () => {
      try {
        const res = await fetch(`/api/follows?followerId=${user.id}&type=following`, { credentials: "include" })
        if (!res.ok) return
        const data = await res.json() as { userID: string }[]
        setFollowing(new Set(data.map(f => f.userID)))
      } catch { /* silent */ }
    })()
  }, [user?.id])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchUsers(q, role)
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, role, fetchUsers])

  const toggleFollow = async (targetId: string) => {
    if (!user?.id || pendingFollow.has(targetId)) return
    const isFollowing = following.has(targetId)
    setPendingFollow(p => new Set(p).add(targetId))
    try {
      if (isFollowing) {
        await fetch("/api/follows", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ followingId: targetId }),
        })
        setFollowing(p => { const s = new Set(p); s.delete(targetId); return s })
      } else {
        await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ followingId: targetId }),
        })
        setFollowing(p => new Set(p).add(targetId))
      }
    } catch {
      notify.error("Something went wrong")
    } finally {
      setPendingFollow(p => { const s = new Set(p); s.delete(targetId); return s })
    }
  }

  return (
    <DashboardLayout showRail={true}>
      <HowTo
        id="explore"
        steps={[
          { icon: "🔍", title: "Search the community", body: "Type a name or username to find anyone on THIMBLE. Results appear instantly as you type." },
          { icon: "🎨", title: "Filter by role", body: "Use the role pills — Designers, Models, Photographers, Brands, Manufacturers — to narrow to the talent you need." },
          { icon: "➕", title: "Follow & connect", body: "Hit Follow on anyone's card to add them to your network. They'll see your profile in return." },
        ]}
      />
      <div className="t-explore">
        {/* Header */}
        <div className="t-explore-header">
          <h1 className="t-explore-title">Explore</h1>
          <p className="t-explore-sub">Find designers, models, photographers, brands & manufacturers</p>
        </div>

        {/* Search bar */}
        <div className="t-search t-explore-search">
          <span className="t-search-ico"><Search size={16} /></span>
          <input
            type="search"
            placeholder="Search by name or username…"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Role filter pills */}
        <div className="t-filterbar">
          {ROLES.map(r => (
            <button
              key={r.value}
              className={`t-pill${role === r.value ? " on" : ""}`}
              onClick={() => setRole(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="t-explore-loading">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="t-explore-card t-explore-card--skeleton" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="t-explore-empty">
            <Users size={40} strokeWidth={1.5} />
            <p>{q || role ? "No one matches that search." : "No users yet."}</p>
          </div>
        ) : (
          <div className="t-explore-grid">
            {results.map(u => {
              const isMe = u.id === user?.id
              const isFollowing = following.has(u.id)
              const isPending = pendingFollow.has(u.id)
              return (
                <div key={u.id} className="t-explore-card">
                  <button
                    className="t-explore-card-body"
                    onClick={() => router.push(`/profile/${u.id}`)}
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.fullName} className="t-explore-av" />
                    ) : (
                      <div className="t-explore-av t-explore-av--ph">
                        {u.fullName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="t-explore-card-meta">
                      <span className="t-explore-card-name">
                        {u.fullName}
                        {u.isVerified && (
                          <BadgeCheck size={14} className="t-explore-verified" />
                        )}
                      </span>
                      {u.username && (
                        <span className="t-explore-card-username">@{u.username}</span>
                      )}
                      {u.role && (
                        <span className="t-explore-card-role">{u.role}</span>
                      )}
                      <span className="t-explore-card-followers">
                        {u.followers.toLocaleString()} {u.followers === 1 ? "follower" : "followers"}
                      </span>
                    </div>
                  </button>
                  {!isMe && (
                    <button
                      className={`t-explore-follow-btn${isFollowing ? " following" : ""}`}
                      onClick={() => void toggleFollow(u.id)}
                      disabled={isPending}
                    >
                      {isFollowing ? "Following" : <><UserPlus size={13} /> Follow</>}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
