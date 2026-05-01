"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tag, Users, Search, ImageIcon, X } from "lucide-react"
import Image from "next/image"
import { uploadToCloudinary } from "@/lib/cloudinary"

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  user: any
}

export function CreatePostModal({ isOpen, onClose, onSuccess, user }: CreatePostModalProps) {
  const [caption, setCaption] = useState("")
  const [postType, setPostType] = useState("design")
  const [imageUrl, setImageUrl] = useState("")
  const [taggedUsers, setTaggedUsers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const url = await uploadToCloudinary(file, (progress) => {
          setUploadProgress(progress)
        })
        setImageUrl(url)
      } catch (err) {
        console.error("Upload failed:", err)
        setUploadProgress(0)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imageUrl) return

    setIsSubmitting(true)
    try {
      const res = await fetch("http://localhost:3001/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          authorName: user?.fullName || "User",
          authorAvatar: (user?.unsafeMetadata?.avatarUrl as string) || user?.imageUrl || "",
          imageUrl: imageUrl,
          description: caption,
          taggedUsers: taggedUsers
        })
      })
      if (res.ok) {
        onSuccess()
        onClose()
        setCaption("")
        setImageUrl("")
        setTaggedUsers([])
        setUploadProgress(0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-none border-neutral-200 dark:border-neutral-800 p-0 overflow-hidden bg-white dark:bg-black">
        <DialogHeader className="p-6 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/50">
          <DialogTitle className="text-xl font-heading font-light tracking-widest uppercase">Create New Post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Content Type</Label>
              <Select value={postType} onValueChange={setPostType}>
                <SelectTrigger className="rounded-none border-neutral-200 dark:border-neutral-800 focus:ring-0">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="design">Design Work</SelectItem>
                  <SelectItem value="campaign">Brand Campaign</SelectItem>
                  <SelectItem value="portfolio">Portfolio Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Tag People</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-400" />
                <Input 
                  placeholder="Search creators..."
                  className="rounded-none pl-8 h-10 border-neutral-200 dark:border-neutral-800 focus:ring-0 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Media Upload</Label>
            {!imageUrl && uploadProgress === 0 ? (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white transition-colors cursor-pointer bg-neutral-50/50 dark:bg-neutral-900/50 group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-8 h-8 mb-4 text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                  <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">Click to upload design</p>
                  <p className="text-[10px] text-neutral-400 uppercase">PNG, JPG, HEIC up to 10MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            ) : uploadProgress < 100 ? (
              <div className="w-full h-48 flex flex-col items-center justify-center border border-neutral-200 dark:border-neutral-800">
                <div className="w-48 h-1 bg-neutral-100 dark:bg-neutral-900 mb-4 overflow-hidden">
                  <div 
                    className="h-full bg-black dark:bg-white transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-neutral-400">Uploading to Cloud... {uploadProgress}%</p>
              </div>
            ) : imageUrl ? (
              <div className="relative aspect-video border border-neutral-100 dark:border-neutral-900 group">
                <Image src={imageUrl} alt="Preview" fill className="object-cover" />
                <button 
                  onClick={() => { setImageUrl(""); setUploadProgress(0); }}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Caption & Context</Label>
            <Textarea 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe your creative process or the inspiration behind this piece..."
              className="rounded-none min-h-[120px] border-neutral-200 dark:border-neutral-800 focus:ring-0 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-900">
            <button type="button" onClick={onClose} className="text-xs uppercase tracking-widest text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
              Save Draft
            </button>
            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={isSubmitting || !imageUrl}
                className="rounded-none bg-black text-white hover:bg-neutral-800 px-10 py-6 uppercase tracking-widest text-xs transition-soft"
              >
                {isSubmitting ? "Uploading..." : "Share to Community"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
