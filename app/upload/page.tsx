"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/useAuth"
import { BottomNav } from "@/components/bottom-nav"
import { ImagePlus, X, Loader2, Home, Grid3X3, User } from "lucide-react"
import Link from "next/link"
import { uploadFile } from "@/lib/upload"

export default function UploadPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [tags, setTags] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth")
    }
  }, [user, isLoading, router])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setSelectedImage(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setSelectedFile(null)
    setSelectedImage(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !caption.trim()) return

    setIsUploading(true)
    setUploadError(null)
    setUploadProgress(0)

    try {
      const imageUrl = await uploadFile(selectedFile, p => setUploadProgress(p))
      const tagList = tags.split(/[\s,]+/).map(t => t.trim().replace(/^#/, "")).filter(Boolean)

      const payload = {
        userId: user?.id,
        authorName: user?.fullName || "User",
        authorAvatar: user?.avatar || "",
        imageUrl,
        description: caption,
        taggedUsers: [] as string[],
        tags: tagList,
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to publish post")

      router.push("/")
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="animate-spin rounded-full"
          style={{ width: 32, height: 32, border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }}
        />
      </div>
    )
  }

  if (!user) return null

  const navItems = [
    { href: "/feed", icon: Home, label: "Feed" },
    { href: "/explore", icon: Grid3X3, label: "Explore" },
    { href: "/profile", icon: User, label: "Profile" },
  ]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="t-topbar">
        <div className="t-topbar-inner">
          <Link href="/" className="t-brand" aria-label="Thimble home">
            <span className="t-brand-mark" aria-hidden="true" />
            <span className="t-brand-name">thimble</span>
          </Link>
          <h1
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--t-ink)",
              margin: 0,
            }}
          >
            New post
          </h1>
          <div style={{ width: 60 }} />
        </div>
      </header>

      <main className="t-shell">
        <div className="t-main">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Image upload card */}
            <div className="glass" style={{ padding: 16 }}>
              <label
                htmlFor="upload-photo-label"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--t-ink-2)",
                  marginBottom: 10,
                }}
              >
                Photo
              </label>

              {!selectedImage ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%",
                    aspectRatio: "4 / 5",
                    maxHeight: 480,
                    borderRadius: 16,
                    border: "2px dashed rgba(29,29,31,0.18)",
                    background: "rgba(255,255,255,0.45)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    color: "var(--t-ink-2)",
                    cursor: "pointer",
                    transition: "background .2s, border-color .2s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.65)"
                    e.currentTarget.style.borderColor = "rgba(29,29,31,0.4)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.45)"
                    e.currentTarget.style.borderColor = "rgba(29,29,31,0.18)"
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      background: "#1d1d1f",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 6px 16px rgba(0,0,0,.18)",
                    }}
                  >
                    <ImagePlus size={24} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontWeight: 600, fontSize: 15, color: "var(--t-ink)", margin: 0 }}>
                      Tap to upload
                    </p>
                    <p style={{ fontSize: 13, color: "var(--t-ink-3)", margin: "4px 0 0" }}>
                      JPG, PNG · up to 10 MB
                    </p>
                  </div>
                </button>
              ) : (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "4 / 5",
                    maxHeight: 480,
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "var(--t-surface-2)",
                  }}
                >
                  <img
                    src={selectedImage}
                    alt="Selected"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label="Remove photo"
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      background: "rgba(20,16,40,0.55)",
                      color: "#fff",
                      border: 0,
                      cursor: "pointer",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </div>

            {/* Caption */}
            <div className="glass" style={{ padding: 16 }}>
              <label
                htmlFor="caption"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--t-ink-2)",
                  marginBottom: 8,
                }}
              >
                Caption
              </label>
              <textarea
                id="caption"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Share your creative process…"
                style={{
                  width: "100%",
                  minHeight: 120,
                  resize: "vertical",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.6)",
                  background: "rgba(255,255,255,0.55)",
                  padding: "12px 14px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  color: "var(--t-ink)",
                  outline: "none",
                  transition: "background .2s, border-color .2s, box-shadow .2s",
                }}
                onFocus={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.78)"
                  e.currentTarget.style.borderColor = "var(--t-gold)"
                  e.currentTarget.style.boxShadow = "0 0 0 4px var(--t-gold-soft)"
                }}
                onBlur={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.55)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              />
            </div>

            {/* Tags */}
            <div className="glass" style={{ padding: 16 }}>
              <label
                htmlFor="tags"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--t-ink-2)",
                  marginBottom: 8,
                }}
              >
                Tags
              </label>
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="#fashion  #editorial  #studio"
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.6)",
                  background: "rgba(255,255,255,0.55)",
                  padding: "0 16px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  color: "var(--t-ink)",
                  outline: "none",
                  transition: "background .2s, border-color .2s, box-shadow .2s",
                }}
                onFocus={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.78)"
                  e.currentTarget.style.borderColor = "var(--t-gold)"
                  e.currentTarget.style.boxShadow = "0 0 0 4px var(--t-gold-soft)"
                }}
                onBlur={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.55)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              />
            </div>

            {uploadError && (
              <p style={{ fontSize: 13, color: "#dc2626", textAlign: "center" }}>{uploadError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!selectedFile || !caption.trim() || isUploading}
              className="t-btn-primary"
              style={{
                height: 52,
                fontSize: 15,
                fontWeight: 600,
                justifyContent: "center",
                opacity: !selectedFile || !caption.trim() || isUploading ? 0.55 : 1,
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading… {uploadProgress}%</span>
                </>
              ) : (
                "Share post"
              )}
            </button>
          </form>
        </div>
      </main>

      <BottomNav items={navItems} />
    </div>
  )
}
