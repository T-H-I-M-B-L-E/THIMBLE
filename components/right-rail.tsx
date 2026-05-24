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
  location: string
}

interface TrendingTag {
  tag: string
  count: number
}

export function RightRail() {
  const user = useStore((s) => s.user)
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([])
  const [tags, setTags] = useState<TrendingTag[]>([])

  useEffect(() => {
    fetch("/api/users/suggestions", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSuggestions(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/tags/trending", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTags(data) })
      .catch(() => {})
  }, [])

  return (
    <aside className="t-rail">
      {user && (
        <div className="t-rail-section">
          <div className="t-rail-greet">Your stats</div>
          <div className="t-rail-stat-row">
            <div className="t-stat">
              <div className="t-stat-num">{user.followers ?? 0}</div>
              <div className="t-stat-lab">Followers</div>
            </div>
            <div className="t-stat">
              <div className="t-stat-num">{user.following ?? 0}</div>
              <div className="t-stat-lab">Following</div>
            </div>
            <div className="t-stat">
              <div className="t-stat-num">{user.posts ?? 0}</div>
              <div className="t-stat-lab">Posts</div>
            </div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="t-rail-section">
          <div className="t-rail-h">People you might know</div>
          <ul className="t-suggest">
            {suggestions.map((person) => (
              <SuggestionRow
                key={person.id}
                person={person}
                profileHref={`/dashboard/${user?.role ?? "model"}/profile/${person.id}`}
                currentUserId={user?.id}
              />
            ))}
          </ul>
        </div>
      )}

      {tags.length > 0 && (
        <div className="t-rail-section">
          <div className="t-rail-h">Trending tags</div>
          <ul className="t-trending">
            {tags.map((t) => (
              <li key={t.tag}>
                <span style={{ cursor: "pointer" }}>#{t.tag}</span>
                <span className="t-muted-xs">{t.count.toLocaleString()} posts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="t-rail-foot">
        <span>About</span>
        <span>·</span>
        <span>Help</span>
        <span>·</span>
        <span>Terms</span>
        <span>·</span>
        <span>© Tvimble</span>
      </div>
    </aside>
  )
}

function SuggestionRow({
  person,
  profileHref,
  currentUserId,
}: {
  person: SuggestedUser
  profileHref: string
  currentUserId?: string
}) {
  const { isFollowing, toggle, pending, isSelf } = useFollow(person.id, currentUserId)

  return (
    <li>
      <Link href={profileHref} aria-label={`${person.fullName} profile`}>
        {person.avatarUrl ? (
          <Image
            src={person.avatarUrl}
            alt={person.fullName}
            width={32}
            height={32}
            className="t-avatar-sm"
            style={{ borderRadius: "50%" }}
          />
        ) : (
          <div
            className="t-avatar-sm"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--t-surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--t-ink)",
            }}
          >
            {person.fullName[0]}
          </div>
        )}
      </Link>
      <Link
        href={profileHref}
        className="t-suggest-meta"
        style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
      >
        <div className="t-strong" style={{ fontSize: "13px" }}>{person.fullName}</div>
        <div className="t-muted-xs">
          {person.role}{person.location ? ` · ${person.location}` : ""}
        </div>
      </Link>
      {!isSelf && (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          style={{
            marginLeft: "auto",
            fontSize: "12px",
            fontWeight: 600,
            padding: "5px 11px",
            borderRadius: 999,
            color: isFollowing ? "var(--t-ink-2)" : "#fff",
            background: isFollowing ? "var(--t-surface-2)" : "var(--t-ink)",
            border: isFollowing ? "1px solid var(--t-line)" : "1px solid var(--t-ink)",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
            fontFamily: "inherit",
            transition: "background .15s, color .15s",
          }}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </li>
  )
}
