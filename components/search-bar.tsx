"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"

interface UserSummary {
  id: string
  fullName: string
  username: string
  avatarUrl: string
  role: string
  isVerified: boolean
}

interface SearchBarProps {
  role?: string
}

/**
 * Topbar search. Loads the user directory once on focus (cheap: backend
 * caps at 200 rows), then filters client-side with a 250ms debounce.
 *
 * Dropdown shows up to 6 matches; click navigates to the user's profile.
 * No-results state renders inline so the user knows the search ran.
 */
export function SearchBar({ role: _role }: SearchBarProps) {
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [users, setUsers] = useState<UserSummary[] | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Lazy-load the directory the first time the user focuses the input.
  const loadUsers = async () => {
    if (users !== null) return
    setLoading(true)
    try {
      const res = await fetch("/api/users", { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  // Debounce query → 250ms quiet window before we filter.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [query])

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur() }
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Cmd/Ctrl-K focuses the input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const results = useMemo(() => {
    if (!debounced || !users) return []
    return users
      .filter(u =>
        u.fullName.toLowerCase().includes(debounced) ||
        u.username?.toLowerCase().includes(debounced) ||
        u.role?.toLowerCase().includes(debounced)
      )
      .slice(0, 6)
  }, [debounced, users])

  const goToProfile = (id: string) => {
    setOpen(false)
    setQuery("")
    router.push(`/profile/${id}`)
  }

  return (
    <div className="t-search" role="search" ref={wrapRef}>
      <Search className="t-search-ico" size={16} />
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { loadUsers(); if (query) setOpen(true) }}
        placeholder="Search people, gigs, tags…"
        aria-label="Search"
        aria-expanded={open}
        aria-haspopup="listbox"
      />
      <span className="t-search-kbd">⌘K</span>

      {open && debounced && (
        <div className="t-search-dropdown" role="listbox">
          {loading && users === null ? (
            <div className="t-search-empty">Loading…</div>
          ) : results.length === 0 ? (
            <div className="t-search-empty">No people found for “{debounced}”</div>
          ) : (
            results.map(u => (
              <button
                key={u.id}
                type="button"
                role="option"
                className="t-search-result"
                onClick={() => goToProfile(u.id)}
              >
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="t-search-result-av" />
                ) : (
                  <div className="t-search-result-av t-search-result-av-ph">
                    {u.fullName[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="t-search-result-meta">
                  <div className="t-search-result-name">
                    {u.fullName}
                    {u.isVerified && <VerifiedBadge size={11} />}
                  </div>
                  <div className="t-search-result-sub">
                    @{u.username || u.fullName.toLowerCase().replace(/\s+/g, "")}
                    {u.role ? ` · ${u.role}` : ""}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
