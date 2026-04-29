"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { BottomNav } from "@/components/bottom-nav"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImagePlus, X, Loader2 } from "lucide-react"
import { useEffect } from "react"

export default function UploadPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [tags, setTags] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth")
    }
  }, [user, isLoading, router])

  const handleFileSelect = (e: React.ChangeEventEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedImage || !caption.trim()) return

    setIsUploading(true)
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 20) {
      setUploadProgress(i)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    // Simulate successful upload
    setTimeout(() => {
      setIsUploading(false)
      setUploadProgress(0)
      router.push("/")
    }, 500)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen pb-16 sm:pb-20 lg:pb-0">
      <Sidebar />

      <main className="flex-1 lg:mr-72 xl:mr-80">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex h-12 sm:h-14 items-center justify-between px-3 sm:px-4 max-w-2xl mx-auto lg:max-w-full lg:border-r lg:border-border">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">Create Post</h1>
          </div>
        </header>

        {/* Upload Form */}
        <div className="mx-auto max-w-xl sm:max-w-2xl px-3 sm:px-4 py-4 sm:py-6 lg:border-r lg:border-border">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Image Upload Area */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Photo</Label>
              
              {!selectedImage ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[4/5] sm:aspect-[4/3] lg:aspect-[4/5] max-h-[400px] sm:max-h-[500px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 sm:gap-4 hover:bg-secondary/50 transition-colors bg-card"
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-secondary flex items-center justify-center">
                    <ImagePlus className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-foreground font-medium text-sm sm:text-base">Click to upload photo</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">JPG, PNG up to 10MB</p>
                  </div>
                </button>
              ) : (
                <div className="relative aspect-[4/5] sm:aspect-[4/3] lg:aspect-[4/5] max-h-[400px] sm:max-h-[500px] rounded-xl overflow-hidden bg-card">
                  <img
                    src={selectedImage}
                    alt="Selected"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption" className="text-sm font-medium text-foreground">
                Caption
              </Label>
              <Textarea
                id="caption"
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[100px] sm:min-h-[120px] bg-secondary border-border text-foreground placeholder:text-muted-foreground resize-none text-sm sm:text-base"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags" className="text-sm font-medium text-foreground">
                Tags
              </Label>
              <Input
                id="tags"
                type="text"
                placeholder="#fashion #design #minimal (separate with spaces)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="h-10 sm:h-11 bg-secondary border-border text-foreground placeholder:text-muted-foreground text-sm sm:text-base"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!selectedImage || !caption.trim() || isUploading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium h-11 sm:h-12"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                "Share Post"
              )}
            </Button>
          </form>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
