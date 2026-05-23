"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Camera, Instagram, Globe, X, User as UserIcon } from "lucide-react"
import { uploadFile } from "@/lib/upload"
import { normalizeWebsiteUrl } from "@/lib/platform"

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

const USERNAME_COOLDOWN_DAYS = 30
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])?$/

function nextUsernameChangeAt(changedAtIso?: string | null): Date | null {
  if (!changedAtIso) return null
  const t = new Date(changedAtIso).getTime()
  if (Number.isNaN(t)) return null
  const next = new Date(t + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
  return next > new Date() ? next : null
}

export function EditProfileModal({ isOpen, onClose, user }: EditProfileModalProps) {
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [website, setWebsite] = useState("")
  const [instagram, setInstagram] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  const initialUsername = (user?.username || "").toLowerCase()
  const nextAllowed = nextUsernameChangeAt(user?.usernameChangedAt)
  const usernameLocked = nextAllowed !== null

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "")
      setUsername((user.username || "").toLowerCase())
      setBio(user.bio || "")
      setWebsite(user.website || "")
      setInstagram(user.instagram || "")
      setAvatarUrl(user.avatar || user.avatarUrl || "")
      setUsernameError(null)
    }
  }, [user, isOpen])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const url = await uploadFile(file, (progress) => {
          setUploadProgress(progress)
        }, "avatars")
        setAvatarUrl(url)
      } catch (err) {
        console.error("Upload failed:", err)
        setUploadProgress(0)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setUsernameError(null)

    const trimmedUsername = username.trim().toLowerCase()
    const usernameChanged = trimmedUsername !== initialUsername

    if (usernameChanged) {
      if (usernameLocked) {
        setUsernameError(`You can change your username again on ${nextAllowed!.toLocaleDateString()}.`)
        return
      }
      if (!USERNAME_RE.test(trimmedUsername)) {
        setUsernameError("3–30 chars. Lowercase letters, numbers, underscore or dot. Must start and end with a letter or number.")
        return
      }
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        bio,
        avatar: avatarUrl,
        website: normalizeWebsiteUrl(website),
      }
      if (usernameChanged) body.username = trimmedUsername

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.error === "username_taken" || data?.error === "username_cooldown" || data?.error === "invalid_username") {
          setUsernameError(data?.message || "Couldn't update username.")
          return
        }
        throw new Error(data?.error || "Failed to update profile")
      }
      window.dispatchEvent(new Event("focus"))
      onClose()
    } catch (err) {
      console.error("Failed to update profile:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-none h-[100dvh] sm:h-auto sm:w-[95vw] sm:max-w-[500px] rounded-none border-0 sm:border sm:border-neutral-200 dark:sm:border-neutral-800 p-0 overflow-hidden bg-white dark:bg-black flex flex-col">
        <DialogHeader className="p-6 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/50 shrink-0">
          <DialogTitle className="text-xl font-light tracking-widest uppercase">Edit Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto sm:max-h-[70vh]">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-2 border-neutral-100 dark:border-neutral-900 overflow-hidden bg-neutral-50 dark:bg-neutral-900">
                {uploadProgress > 0 && uploadProgress < 100 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 text-white">
                    <span className="text-[10px] font-mono">{uploadProgress}%</span>
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UserIcon className="h-10 w-10 text-neutral-300" />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-black dark:bg-white rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg">
                <Camera className="h-4 w-4 text-white dark:text-black" />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-400">Change Profile Photo</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500">Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-none border-neutral-200 dark:border-neutral-800 focus:ring-0"
                placeholder="Jane Doe"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                Username
                {usernameLocked && (
                  <span className="text-[10px] normal-case tracking-normal text-neutral-400">
                    locked until {nextAllowed!.toLocaleDateString()}
                  </span>
                )}
              </Label>
              <div className="flex items-center border border-neutral-200 dark:border-neutral-800">
                <span className="px-3 text-sm text-neutral-400 select-none">@</span>
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase())
                    if (usernameError) setUsernameError(null)
                  }}
                  disabled={usernameLocked}
                  maxLength={30}
                  className="rounded-none border-0 focus:ring-0 pl-0"
                  placeholder="jane.doe"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] text-neutral-500">
                {usernameError ? (
                  <span className="text-red-500">{usernameError}</span>
                ) : usernameLocked ? (
                  `You can change your username once every ${USERNAME_COOLDOWN_DAYS} days.`
                ) : (
                  `3–30 characters. Lowercase letters, numbers, _ or .  Heads up: you can only change this once every ${USERNAME_COOLDOWN_DAYS} days.`
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500">Professional Bio</Label>
              <Textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="rounded-none min-h-[100px] border-neutral-200 dark:border-neutral-800 focus:ring-0 resize-none text-sm"
                placeholder="Tell the community about your expertise..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                  <Instagram className="h-3 w-3" /> Instagram
                </Label>
                <Input 
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="rounded-none border-neutral-200 dark:border-neutral-800 focus:ring-0 text-xs"
                  placeholder="@handle"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                  <Globe className="h-3 w-3" /> Website
                </Label>
                <Input 
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="rounded-none border-neutral-200 dark:border-neutral-800 focus:ring-0 text-xs"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-900">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1 rounded-none border-neutral-200 uppercase tracking-widest text-[10px] h-12"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || (uploadProgress > 0 && uploadProgress < 100)}
              className="flex-[2] rounded-none bg-black text-white hover:bg-neutral-800 uppercase tracking-widest text-[10px] h-12"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
