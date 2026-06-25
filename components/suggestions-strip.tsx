"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useStore } from "@/lib/store"
import { useFollow } from "@/hooks/use-social"

interface SuggestedUser {
  id: string
  fullName: string
  avatarUrl: string
  role: string
}

function SuggestionCard({ person, currentUserId }: { person: SuggestedUser; currentUserId?: string }) {
  const { isFollowing, toggle, pending, isSelf } = useFollow(person.id, currentUserId)

  return (
    <li>
      <Link href={`/profile/${person.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        {person.avatarUrl ? (
          <Image
            src={person.avatarUrl}
            alt={person.fullName}
            width={48}
            height={48}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--t-surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 600, color: "var(--t-ink)",
          }}>
            {person.fullName[0]}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t-ink)", marginTop: 4, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {person.fullName}
        </div>
        <div style={{ fontSize: 11, color: "var(--t-ink-3)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {person.role}
        </div>
      </Link>
      {!isSelf && (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          style={{
            marginTop: 6, fontSize: 11, fontWeight: 600,
            padding: "3px 10px", borderRadius: 999,
            color: isFollowing ? "var(--t-ink-2)" : "#fff",
            background: isFollowing ? "var(--t-surface-2)" : "var(--t-ink)",
            border: isFollowing ? "1px solid var(--t-line)" : "1px solid var(--t-ink)",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </li>
  )
}

export function SuggestionsStrip() {
  const user = useStore((s) => s.user)
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([])

  useEffect(() => {
    fetch("/api/users/suggestions", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSuggestions(data) })
      .catch(() => {})
  }, [])

  if (!suggestions.length) return null

  return (
    <div className="t-rail-inline">
      <div className="t-rail-h">People you might know</div>
      <ul className="t-suggest">
        {suggestions.map((person) => (
          <SuggestionCard key={person.id} person={person} currentUserId={user?.id} />
        ))}
      </ul>
    </div>
  )
}
