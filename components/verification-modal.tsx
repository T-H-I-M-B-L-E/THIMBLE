"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, Clock, ShieldCheck, X } from "lucide-react"
import { uploadFile } from "@/lib/upload"
import { VerifiedBadge } from "@/components/verified-badge"

interface VerificationRequest {
  id: number
  status: "pending" | "approved" | "rejected"
  fullName: string
  email: string
  idDocumentUrl: string
  reason: string
  adminNote?: string
  createdAt: string
}

interface VerificationModalProps {
  isOpen: boolean
  onClose: () => void
  user: { id?: string; fullName?: string; email?: string; verificationStatus?: string } | null
  onSubmitted?: () => void
}

export function VerificationModal({ isOpen, onClose, user, onSubmitted }: VerificationModalProps) {
  const [existing, setExisting] = useState<VerificationRequest | null>(null)
  const [loading, setLoading] = useState(true)

  const [fullName, setFullName] = useState(user?.fullName || "")
  const [email, setEmail] = useState(user?.email || "")
  const [reason, setReason] = useState("")
  const [idDocumentUrl, setIdDocumentUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    fetch("/api/verification/me", { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : { request: null })
      .then(d => setExisting(d?.request ?? null))
      .catch(() => setExisting(null))
      .finally(() => setLoading(false))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setFullName(user?.fullName || "")
    setEmail(user?.email || "")
    setReason("")
    setIdDocumentUrl("")
    setUploadProgress(0)
  }, [isOpen, user])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const url = await uploadFile(file, p => setUploadProgress(p), "verification")
      setIdDocumentUrl(url)
    } catch {
      setError("Upload failed. Try again.")
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const canSubmit =
    !submitting && !uploading &&
    fullName.trim() !== "" &&
    email.trim() !== "" &&
    reason.trim() !== "" &&
    idDocumentUrl !== ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          idDocumentUrl,
          reason: reason.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to submit")
      setExisting({
        id: data.id ?? 0,
        status: "pending",
        fullName: fullName.trim(),
        email: email.trim(),
        idDocumentUrl,
        reason: reason.trim(),
        createdAt: new Date().toISOString(),
      })
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  const isVerified = user?.verificationStatus === "verified"
  const hasPending = !!existing && existing.status === "pending"
  const wasRejected = !!existing && existing.status === "rejected"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-none h-dvh sm:h-auto sm:w-[95vw] sm:max-w-[480px] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-5 border-b border-(--t-line) shrink-0 flex flex-row items-center gap-3">
          <span style={{
            width: 32, height: 32, borderRadius: 999,
            background: "rgba(212,169,58,0.14)",
            border: "1px solid rgba(212,169,58,0.30)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#B07F1A", flexShrink: 0,
          }}>
            <ShieldCheck size={16} />
          </span>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Get verified
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : isVerified ? (
            <StatusCard
              icon={<VerifiedBadge size={36} />}
              title="You're verified"
              body="The gold badge appears next to your name across the app."
            />
          ) : hasPending ? (
            <StatusCard
              icon={<Clock size={36} color="#B07F1A" />}
              title="Verification in review"
              body="We've received your application. You'll be notified once a decision is made."
              footnote={`Submitted on ${new Date(existing!.createdAt).toLocaleDateString()}`}
            />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {wasRejected && (
                <div style={{
                  padding: 12, borderRadius: 12,
                  background: "rgba(220,38,38,0.06)",
                  border: "1px solid rgba(220,38,38,0.20)",
                  fontSize: 12, color: "#dc2626",
                }}>
                  Your previous request was rejected.
                  {existing?.adminNote && <> Reason: <em>{existing.adminNote}</em></>} You can apply again.
                </div>
              )}

              <p style={{ fontSize: 13, color: "var(--t-ink-2)", lineHeight: 1.5, margin: 0 }}>
                Verification adds a gold badge to your name. Submit your details and a
                photo of your government ID. We'll review within a few days.
              </p>

              <Field label="Full name" required>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={120} />
              </Field>

              <Field label="Email" required>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={200} />
              </Field>

              <Field label="Government ID" required hint="JPG, PNG or PDF · up to 10 MB">
                {idDocumentUrl ? (
                  <div style={previewWrap}>
                    {idDocumentUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={idDocumentUrl} alt="ID" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--t-ink-2)", fontSize: 13 }}>
                        Document uploaded
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setIdDocumentUrl(""); setUploadProgress(0) }}
                      aria-label="Remove document"
                      style={removeBtn}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : uploading ? (
                  <div style={{ ...dropzone, cursor: "default" }}>
                    <Loader2 className="animate-spin" size={20} />
                    <span style={{ fontSize: 12, color: "var(--t-ink-3)" }}>
                      Uploading… {uploadProgress}%
                    </span>
                  </div>
                ) : (
                  <label style={dropzone}>
                    <Upload size={22} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t-ink)" }}>Tap to upload ID</span>
                    <span style={{ fontSize: 11, color: "var(--t-ink-3)" }}>JPG, PNG · up to 10 MB</span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </Field>

              <Field label="Reason for verification" required>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Tell us why your account should be verified…"
                  required
                  maxLength={500}
                  className="resize-none text-[14px] rounded-2xl"
                  style={{
                    background: "rgba(255,255,255,0.55)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    minHeight: 100,
                  }}
                />
              </Field>

              {error && <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="t-btn-quiet" style={{ fontSize: 13 }}>
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
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : "Submit application"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium" style={{ color: "var(--t-ink-2)" }}>
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
        {hint && <span style={{ color: "var(--t-ink-3)", fontWeight: 400, marginLeft: 6 }}>({hint})</span>}
      </Label>
      {children}
    </div>
  )
}

function StatusCard({
  icon, title, body, footnote,
}: { icon: React.ReactNode; title: string; body: string; footnote?: string }) {
  return (
    <div style={{
      padding: 24, borderRadius: 18, textAlign: "center",
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(255,255,255,0.65)",
    }}>
      <div style={{ marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 18, fontWeight: 600, color: "var(--t-ink)", marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: "var(--t-ink-2)", lineHeight: 1.5 }}>{body}</p>
      {footnote && <p style={{ fontSize: 11, color: "var(--t-ink-3)", marginTop: 14 }}>{footnote}</p>}
    </div>
  )
}

const dropzone: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  gap: 8, padding: "24px 16px", borderRadius: 16, cursor: "pointer",
  border: "2px dashed rgba(29,29,31,0.18)",
  background: "rgba(255,255,255,0.45)",
  color: "var(--t-ink-2)",
}

const previewWrap: React.CSSProperties = {
  position: "relative", width: "100%", height: 180,
  borderRadius: 14, overflow: "hidden",
  background: "var(--t-surface-2)",
}

const removeBtn: React.CSSProperties = {
  position: "absolute", top: 8, right: 8,
  width: 28, height: 28, borderRadius: "50%",
  background: "rgba(20,16,40,0.55)", color: "#fff",
  border: 0, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
}
