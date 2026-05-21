"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Users, ImageIcon, X, Loader2, ArrowLeft, Camera, Type } from "lucide-react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { uploadFile } from "@/lib/upload"
import { useUsers, type UserSummary } from "@/hooks/use-users"

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  user: any
}

type Mode = "choose" | "photo" | "text"

export function CreatePostModal({ isOpen, onClose, onSuccess, user }: CreatePostModalProps) {
  const [mode, setMode] = useState<Mode>("choose")
  const [caption, setCaption] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [taggedIds, setTaggedIds] = useState<string[]>([])
  const [tagSearch, setTagSearch] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const { users, isLoading: usersLoading } = useUsers()
  const tagSearchRef = useRef<HTMLInputElement>(null)

  // Reset every field when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setMode("choose")
      setCaption("")
      setImageUrl("")
      setTaggedIds([])
      setTagSearch("")
      setUploadProgress(0)
      setError(null)
    }
  }, [isOpen])

  const taggedUsers = useMemo<UserSummary[]>(
    () => taggedIds.map(id => users.find(u => u.id === id)).filter(Boolean) as UserSummary[],
    [taggedIds, users]
  )

  const matches = useMemo<UserSummary[]>(() => {
    const q = tagSearch.trim().toLowerCase()
    const base = users.filter(u => u.id !== user?.id && !taggedIds.includes(u.id))
    if (!q) return base.slice(0, 6)
    return base
      .filter(u => u.fullName?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [users, tagSearch, taggedIds, user?.id])

  const canSubmit = !isSubmitting && (
    (mode === "photo" && imageUrl !== "") ||
    (mode === "text"  && caption.trim() !== "")
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError(null)
      const url = await uploadFile(file, p => setUploadProgress(p), "posts")
      setImageUrl(url)
    } catch (err) {
      console.error(err)
      setError("Upload failed. Try again.")
      setUploadProgress(0)
    }
  }

  const toggleTag = (id: string) => {
    setTaggedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setTagSearch("")
    tagSearchRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    if (!user?.id) {
      setError("You must be signed in to post.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const payload = {
        userId: user.id,
        authorName: user.fullName || "User",
        authorAvatar: user.avatar || "",
        imageUrl: mode === "photo" ? imageUrl : "",
        description: caption.trim(),
        taggedUsers: taggedIds,
      }
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
      window.dispatchEvent(new Event("thimble:post-created"))
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const transition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] as const }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-none h-dvh sm:h-auto sm:w-[95vw] sm:max-w-130 p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-5 border-b border-(--t-line) shrink-0 flex flex-row items-center gap-3">
          {mode !== "choose" && (
            <button
              type="button"
              onClick={() => setMode("choose")}
              aria-label="Back"
              style={{
                width: 32, height: 32, borderRadius: 999,
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.65)",
                cursor: "pointer", color: "var(--t-ink)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {mode === "choose" && "New post"}
            {mode === "photo"  && "Share a photo"}
            {mode === "text"   && "Share an update"}
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {/* ─── Step 1: choose mode ─────────────────────────────────── */}
            {mode === "choose" && (
              <motion.div
                key="choose"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={transition}
                className="h-full overflow-y-auto p-5"
              >
                <p style={{ fontSize: 14, color: "var(--t-ink-2)", marginBottom: 18 }}>
                  What would you like to share?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard
                    icon={<Camera size={22} />}
                    title="Photo"
                    description="Upload an image with an optional caption."
                    onClick={() => setMode("photo")}
                  />
                  <ChoiceCard
                    icon={<Type size={22} />}
                    title="Text"
                    description="Write how you're feeling. No image needed."
                    onClick={() => setMode("text")}
                  />
                </div>
              </motion.div>
            )}

            {/* ─── Step 2: photo flow ──────────────────────────────────── */}
            {mode === "photo" && (
              <motion.form
                key="photo"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={transition}
                onSubmit={handleSubmit}
                className="h-full overflow-y-auto p-5 flex flex-col gap-5"
              >
                {/* Photo upload — primary */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium" style={{ color: "var(--t-ink-2)" }}>
                    Photo
                  </Label>
                  {!imageUrl && uploadProgress === 0 ? (
                    <label
                      style={dropzoneStyle}
                      onMouseEnter={hoverIn}
                      onMouseLeave={hoverOut}
                    >
                      <span style={{
                        width: 56, height: 56, borderRadius: 999,
                        background: "#1d1d1f", color: "#fff",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 6px 16px rgba(0,0,0,.18)",
                      }}>
                        <ImageIcon size={22} />
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)" }}>
                        Tap to upload
                      </span>
                      <span style={{ fontSize: 12, color: "var(--t-ink-3)" }}>
                        JPG, PNG · up to 10 MB
                      </span>
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                    </label>
                  ) : uploadProgress > 0 && uploadProgress < 100 ? (
                    <div style={uploadingStyle}>
                      <div style={progressTrackStyle}>
                        <div style={{ ...progressBarStyle, width: `${uploadProgress}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--t-ink-3)" }}>
                        Uploading… {uploadProgress}%
                      </span>
                    </div>
                  ) : (
                    <div style={imagePreviewStyle}>
                      <Image src={imageUrl} alt="Preview" fill style={{ objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => { setImageUrl(""); setUploadProgress(0) }}
                        aria-label="Remove photo"
                        style={removeBtnStyle}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Caption — optional for photo mode */}
                <CaptionField
                  caption={caption}
                  onChange={setCaption}
                  label="Caption"
                  hint="optional"
                  placeholder="Add a caption…"
                />

                {/* Tag people */}
                <TagPicker
                  inputRef={tagSearchRef}
                  taggedUsers={taggedUsers}
                  matches={matches}
                  search={tagSearch}
                  setSearch={setTagSearch}
                  toggle={toggleTag}
                  isLoading={usersLoading}
                />

                {error && <ErrorLine text={error} />}

                <SubmitRow
                  canSubmit={canSubmit}
                  isSubmitting={isSubmitting}
                  onCancel={onClose}
                />
              </motion.form>
            )}

            {/* ─── Step 2: text flow ───────────────────────────────────── */}
            {mode === "text" && (
              <motion.form
                key="text"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={transition}
                onSubmit={handleSubmit}
                className="h-full overflow-y-auto p-5 flex flex-col gap-5"
              >
                {/* Caption — primary, autofocused */}
                <CaptionField
                  caption={caption}
                  onChange={setCaption}
                  label="How are you feeling?"
                  placeholder="Share what's on your mind…"
                  autoFocus
                  minHeight={160}
                />

                {/* Tag people */}
                <TagPicker
                  inputRef={tagSearchRef}
                  taggedUsers={taggedUsers}
                  matches={matches}
                  search={tagSearch}
                  setSearch={setTagSearch}
                  toggle={toggleTag}
                  isLoading={usersLoading}
                />

                {error && <ErrorLine text={error} />}

                <SubmitRow
                  canSubmit={canSubmit}
                  isSubmitting={isSubmitting}
                  onCancel={onClose}
                />
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function ChoiceCard({
  icon, title, description, onClick,
}: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10,
        padding: 18, borderRadius: 18, cursor: "pointer", textAlign: "left",
        background: "rgba(255,255,255,0.65)",
        border: "1px solid rgba(255,255,255,0.55)",
        boxShadow: "0 4px 14px rgba(20,16,40,0.06), inset 0 1px rgba(255,255,255,0.55)",
        transition: "transform .18s cubic-bezier(0.32,0.72,0,1), box-shadow .25s",
        fontFamily: "inherit",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)"
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(20,16,40,0.10), inset 0 1px rgba(255,255,255,0.6)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 4px 14px rgba(20,16,40,0.06), inset 0 1px rgba(255,255,255,0.55)"
      }}
      onMouseDown={e => (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={e => (e.currentTarget.style.transform = "translateY(-2px)")}
    >
      <span style={{
        width: 44, height: 44, borderRadius: 999,
        background: "#1d1d1f", color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,.18)",
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--t-ink)" }}>
        {title}
      </span>
      <span style={{ fontSize: 12, color: "var(--t-ink-2)", lineHeight: 1.45 }}>
        {description}
      </span>
    </button>
  )
}

function CaptionField({
  caption, onChange, label, hint, placeholder, autoFocus, minHeight = 110,
}: {
  caption: string
  onChange: (v: string) => void
  label: string
  hint?: string
  placeholder: string
  autoFocus?: boolean
  minHeight?: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium" style={{ color: "var(--t-ink-2)" }}>
        {label}{" "}
        {hint && <span style={{ color: "var(--t-ink-3)", fontWeight: 400 }}>({hint})</span>}
      </Label>
      <Textarea
        value={caption}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="resize-none text-[15px] rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.55)",
          border: "1px solid rgba(255,255,255,0.65)",
          minHeight,
        }}
        maxLength={2000}
      />
    </div>
  )
}

function TagPicker({
  inputRef, taggedUsers, matches, search, setSearch, toggle, isLoading,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  taggedUsers: UserSummary[]
  matches: UserSummary[]
  search: string
  setSearch: (v: string) => void
  toggle: (id: string) => void
  isLoading: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium" style={{ color: "var(--t-ink-2)" }}>
        Tag people <span style={{ color: "var(--t-ink-3)", fontWeight: 400 }}>(optional)</span>
      </Label>

      {taggedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {taggedUsers.map(u => (
            <span
              key={u.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 6px 4px 4px", borderRadius: 999,
                background: "rgba(29,29,31,0.06)",
                border: "1px solid rgba(29,29,31,0.10)",
                fontSize: 12, color: "var(--t-ink)",
              }}
            >
              {u.avatarUrl ? (
                <Image
                  src={u.avatarUrl} alt={u.fullName}
                  width={20} height={20}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(29,29,31,0.10)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 600,
                }}>
                  {u.fullName?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span style={{ fontWeight: 500 }}>{u.fullName}</span>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                aria-label={`Remove ${u.fullName}`}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--t-ink-3)", display: "flex", alignItems: "center",
                  padding: 2,
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Users
          size={14}
          style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--t-ink-3)", pointerEvents: "none",
          }}
        />
        <Input
          ref={inputRef}
          placeholder={isLoading ? "Loading users…" : "Search anyone…"}
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={isLoading}
          className="pl-9 h-10 rounded-full text-sm"
          style={{
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.65)",
          }}
        />
      </div>

      {(search.trim() !== "" || matches.length > 0) && !isLoading && (
        <div
          style={{
            marginTop: 4,
            borderRadius: 14,
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 4px 16px rgba(20,16,40,0.06)",
            maxHeight: 220,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {matches.length === 0 ? (
            <p style={{ padding: "12px 14px", fontSize: 13, color: "var(--t-ink-3)" }}>
              No matches.
            </p>
          ) : (
            matches.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", background: "transparent", border: 0,
                  textAlign: "left", cursor: "pointer", width: "100%",
                  transition: "background .12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.55)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {u.avatarUrl ? (
                  <Image
                    src={u.avatarUrl} alt={u.fullName}
                    width={28} height={28}
                    style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(29,29,31,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600, color: "var(--t-ink)",
                    flexShrink: 0,
                  }}>
                    {u.fullName?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--t-ink)" }}>
                    {u.fullName}
                  </span>
                  {u.role && (
                    <span style={{ display: "block", fontSize: 11, color: "var(--t-ink-3)", textTransform: "capitalize" }}>
                      {u.role}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SubmitRow({
  canSubmit, isSubmitting, onCancel,
}: { canSubmit: boolean; isSubmitting: boolean; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="t-btn-quiet"
        style={{ fontSize: 13 }}
      >
        Cancel
      </button>
      <Button
        type="submit"
        disabled={!canSubmit}
        className="t-btn-primary"
        style={{
          height: 40, padding: "0 20px", fontSize: 14, fontWeight: 600,
          opacity: canSubmit ? 1 : 0.55,
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Posting…
          </>
        ) : (
          "Share post"
        )}
      </Button>
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: "#dc2626", textAlign: "center" }}>{text}</p>
}

// ─── Static styles ────────────────────────────────────────────────────────

const dropzoneStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  gap: 10, padding: "32px 16px", borderRadius: 18, cursor: "pointer",
  border: "2px dashed rgba(29,29,31,0.18)",
  background: "rgba(255,255,255,0.45)",
  transition: "background .15s, border-color .15s",
  color: "var(--t-ink-2)",
}

const hoverIn = (e: React.MouseEvent<HTMLLabelElement>) => {
  e.currentTarget.style.background = "rgba(255,255,255,0.65)"
  e.currentTarget.style.borderColor = "rgba(29,29,31,0.32)"
}

const hoverOut = (e: React.MouseEvent<HTMLLabelElement>) => {
  e.currentTarget.style.background = "rgba(255,255,255,0.45)"
  e.currentTarget.style.borderColor = "rgba(29,29,31,0.18)"
}

const uploadingStyle: React.CSSProperties = {
  height: 140, borderRadius: 16, background: "rgba(255,255,255,0.55)",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
}
const progressTrackStyle: React.CSSProperties = {
  width: 180, height: 3, background: "rgba(29,29,31,0.10)", borderRadius: 999, overflow: "hidden",
}
const progressBarStyle: React.CSSProperties = {
  height: "100%", background: "var(--t-ink)", transition: "width .2s",
}

const imagePreviewStyle: React.CSSProperties = {
  position: "relative", width: "100%", maxHeight: 320,
  borderRadius: 16, overflow: "hidden", aspectRatio: "16/10",
  background: "var(--t-surface-2)",
}

const removeBtnStyle: React.CSSProperties = {
  position: "absolute", top: 10, right: 10,
  width: 30, height: 30, borderRadius: "50%",
  background: "rgba(20,16,40,0.55)", color: "#fff",
  border: 0, cursor: "pointer",
  backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
  display: "flex", alignItems: "center", justifyContent: "center",
}
