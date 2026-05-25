"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Image from "next/image"
import { ImageIcon, Loader2, X, Users } from "lucide-react"
import { uploadFile } from "@/lib/upload"
import type { PostData } from "@/components/post-card"
import { TextType } from "@/components/text-type"

// 15 placeholder prompts. Cycles via TextType so it feels alive.
const COMPOSER_PROMPTS = [
  "What's happening?",
  "What's good?",
  "What's on your mind?",
  "Share something with the world…",
  "Post a moment from today",
  "Drop your latest work",
  "What inspired you today?",
  "Working on something new?",
  "Show off the fit",
  "Behind-the-scenes anyone?",
  "What's the vibe today?",
  "Tag a designer you love",
  "Pin a mood to the board",
  "What did you shoot today?",
  "Spill the tea ☕",
]

const MAX_CHARS = 280
const COUNTER_VISIBLE_AT = 240

interface UserSummary {
  id: string
  fullName: string
  avatarUrl?: string
}

interface InlineComposerProps {
  user: { id?: string; fullName?: string; avatar?: string } | null
  onOptimistic: (post: PostData) => string
  onCommit: (tempId: string, real: PostData) => void
  onRevert: (tempId: string, error: string) => void
}

export function InlineComposer({ user, onOptimistic, onCommit, onRevert }: InlineComposerProps) {
  const [text, setText] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [focused, setFocused] = useState(false)
  const [taggedIds, setTaggedIds] = useState<string[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [search, setSearch] = useState("")
  const [showMatches, setShowMatches] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const tagSearchRef = useRef<HTMLInputElement>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Auto-grow the textarea
  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }
  useEffect(resize, [text])

  // FAB / external request → focus the composer
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault() // signal dashboard-layout: we handled it, don't open modal
      textareaRef.current?.focus()
      wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    window.addEventListener("thimble:request-compose", handler)
    return () => window.removeEventListener("thimble:request-compose", handler)
  }, [])

  // Fetch users when tag search changes
  useEffect(() => {
    if (!search.trim()) {
      setUsers([])
      return
    }
    setIsLoadingUsers(true)
    fetch(`/api/users?search=${encodeURIComponent(search)}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setUsers(Array.isArray(data) ? data : [])
      })
      .catch(() => setUsers([]))
      .finally(() => setIsLoadingUsers(false))
  }, [search])

  const taggedUsers = useMemo<UserSummary[]>(
    () => taggedIds.map(id => users.find(u => u.id === id) || ({ id, fullName: "Unknown" })).filter(Boolean) as UserSummary[],
    [taggedIds, users]
  )

  const matches = useMemo<UserSummary[]>(
    () => users.filter(u => !taggedIds.includes(u.id)),
    [users, taggedIds]
  )

  const toggleTag = (id: string) => {
    setTaggedIds(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id])
  }

  const remaining = MAX_CHARS - text.length
  const showCounter = text.length >= COUNTER_VISIBLE_AT
  const overLimit = remaining < 0
  const canPost = !posting && !uploading && !overLimit && (text.trim().length > 0 || imageUrl !== null)

  const handlePickImage = () => fileInputRef.current?.click()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file, undefined, "posts")
      setImageUrl(url)
    } catch (err) {
      console.error(err)
      onRevert("", err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!canPost) return
    if (!user?.id) {
      onRevert("", "You must be signed in to post.")
      return
    }

    const payload = {
      userId: user.id,
      authorName: user.fullName || "User",
      authorAvatar: user.avatar || "",
      imageUrl: imageUrl ?? "",
      description: text.trim(),
      taggedUsers: taggedIds,
    }

    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const optimistic: PostData = {
      id: tempId,
      userId: user.id,
      authorName: payload.authorName,
      authorAvatar: payload.authorAvatar,
      imageUrl: payload.imageUrl,
      description: payload.description,
      likes: 0,
      commentCount: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
      taggedUsers: taggedIds,
    }

    onOptimistic(optimistic)
    setText("")
    setImageUrl(null)
    setTaggedIds([])
    setSearch("")
    setFocused(false)
    textareaRef.current?.blur()
    setPosting(true)

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to publish post.")
      }
      const created = await res.json().catch(() => null)
      onCommit(tempId, (created ?? optimistic) as PostData)
      window.dispatchEvent(new Event("thimble:post-created"))
    } catch (err) {
      onRevert(tempId, err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPosting(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  const expanded = focused || text.length > 0 || imageUrl !== null

  return (
    <div className="t-icomp" ref={wrapRef} data-expanded={expanded || undefined}>
      <div className="t-icomp-row">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.fullName || "Me"}
            className="t-icomp-avatar"
          />
        ) : (
          <div className="t-icomp-avatar t-avatar-ph">
            {user?.fullName?.[0]?.toUpperCase() ?? "U"}
          </div>
        )}

        <div className="t-icomp-body">
          <div className="t-icomp-textwrap">
            {/* Animated ghost placeholder. Hidden once the user types or
                focuses, so it never competes with real input. */}
            {!text && !focused && (
              <div className="t-icomp-ghost" aria-hidden="true">
                <TextType
                  text={COMPOSER_PROMPTS}
                  typingSpeed={55}
                  deletingSpeed={28}
                  pauseDuration={1800}
                  cursorCharacter="_"
                  cursorBlinkDuration={0.55}
                  variableSpeed={{ min: 40, max: 90 }}
                />
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="t-icomp-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_CHARS + 40}
              aria-label="Compose post"
            />
          </div>

          {imageUrl && (
            <div
              className="t-icomp-preview"
              onMouseDown={e => e.preventDefault()}
            >
              <Image src={imageUrl} alt="Attached" fill style={{ objectFit: "cover" }} />
              <button
                type="button"
                className="t-icomp-preview-x"
                onClick={() => setImageUrl(null)}
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {expanded && (
            <>
              {/* Tag picker */}
              <div style={{ paddingTop: 12, paddingBottom: 8 }}>
                {taggedUsers.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {taggedUsers.map(u => (
                      <span
                        key={u.id}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "4px 6px 4px 4px", borderRadius: 999,
                          background: "rgba(29,29,31,0.06)",
                          border: "1px solid rgba(29,29,31,0.10)",
                          fontSize: 12, color: "var(--t-ink)",
                        }}
                      >
                        {u.avatarUrl ? (
                          <Image
                            src={u.avatarUrl} alt={u.fullName}
                            width={16} height={16}
                            style={{ borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <span style={{
                            width: 16, height: 16, borderRadius: "50%",
                            background: "rgba(29,29,31,0.10)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 600,
                          }}>
                            {u.fullName?.[0]?.toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontWeight: 500 }}>{u.fullName}</span>
                        <button
                          type="button"
                          onClick={() => toggleTag(u.id)}
                          aria-label={`Remove ${u.fullName}`}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--t-ink-3)", display: "flex", alignItems: "center",
                            padding: 2,
                          }}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <Users
                    size={12}
                    style={{
                      position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                      color: "var(--t-ink-3)", pointerEvents: "none",
                    }}
                  />
                  <input
                    ref={tagSearchRef}
                    type="text"
                    placeholder={isLoadingUsers ? "Loading…" : "Tag people (optional)"}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => setShowMatches(true)}
                    onBlur={() => setTimeout(() => setShowMatches(false), 100)}
                    disabled={isLoadingUsers}
                    style={{
                      width: "100%", padding: "6px 8px 6px 28px", fontSize: 13,
                      borderRadius: 6, border: "1px solid var(--t-line)",
                      background: "var(--t-surface)", color: "var(--t-ink)",
                      boxSizing: "border-box",
                    }}
                  />
                  {showMatches && matches.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                      borderRadius: 6, border: "1px solid var(--t-line)",
                      background: "var(--t-surface)", zIndex: 10, maxHeight: 200, overflowY: "auto",
                    }}>
                      {matches.slice(0, 5).map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { toggleTag(u.id); setSearch(""); setShowMatches(false) }}
                          style={{
                            width: "100%", padding: "8px", textAlign: "left",
                            border: "none", background: "transparent",
                            borderBottom: "1px solid var(--t-line)",
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                            color: "var(--t-ink)", fontSize: 13,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.16)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          {u.avatarUrl ? (
                            <Image src={u.avatarUrl} alt={u.fullName} width={24} height={24} style={{ borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--t-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>
                              {u.fullName?.[0]?.toUpperCase()}
                            </span>
                          )}
                          <span>{u.fullName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="t-icomp-foot">
                <div className="t-icomp-foot-left">
                  <button
                    type="button"
                    className="t-icomp-iconbtn"
                    onClick={handlePickImage}
                    onMouseDown={e => e.preventDefault()}
                    disabled={uploading || posting}
                    aria-label="Attach image"
                  >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    style={{ display: "none" }}
                  />
                </div>

                <div className="t-icomp-foot-right">
                  {showCounter && (
                    <span
                      className="t-icomp-counter"
                      data-warn={remaining <= 20 && !overLimit ? "" : undefined}
                      data-over={overLimit ? "" : undefined}
                    >
                      {remaining}
                    </span>
                  )}
                  <button
                    type="button"
                    className="t-icomp-post"
                    disabled={!canPost}
                    onClick={handleSubmit}
                  >
                    {posting ? <Loader2 size={14} className="animate-spin" /> : "Post"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
