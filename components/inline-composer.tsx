"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ImageIcon, Loader2, X } from "lucide-react"
import { uploadFile } from "@/lib/upload"
import type { PostData } from "@/components/post-card"

const MAX_CHARS = 280
const COUNTER_VISIBLE_AT = 240

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
      taggedUsers: [] as string[],
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
      taggedUsers: [],
    }

    onOptimistic(optimistic)
    setText("")
    setImageUrl(null)
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
          <textarea
            ref={textareaRef}
            className="t-icomp-textarea"
            placeholder="What's happening?"
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_CHARS + 40}
            aria-label="Compose post"
          />

          {imageUrl && (
            <div className="t-icomp-preview">
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
            <div className="t-icomp-foot">
              <div className="t-icomp-foot-left">
                <button
                  type="button"
                  className="t-icomp-iconbtn"
                  onClick={handlePickImage}
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
          )}
        </div>
      </div>
    </div>
  )
}
