"use client"

import { useUser } from "@clerk/nextjs"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Grid3X3, Settings, Shield, Globe, Instagram, Trash2 } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { use, useState, useEffect } from "react"
import { EditProfileModal } from "@/components/edit-profile-modal"

export default function ProfilePage({ params }: { params: Promise<{ role: string }> }) {
  const router = useRouter()
  const { role } = use(params)
  const { user, isLoaded } = useUser()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)

  useEffect(() => {
    if (isLoaded && user) {
      fetchUserPosts()
    }
  }, [isLoaded, user])

  const fetchUserPosts = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/posts")
      const allPosts = await res.json()
      const filtered = allPosts.filter((p: any) => p.userId === user?.id)
      setUserPosts(filtered)
    } catch (err) {
      console.error("Failed to fetch user posts:", err)
    } finally {
      setIsLoadingPosts(false)
    }
  }

  const handleDeletePost = async (postId: number) => {
    if (!confirm("Remove this piece from your portfolio?")) return
    
    try {
      const res = await fetch(`http://localhost:3001/api/posts/${postId}`, {
        method: "DELETE"
      })
      if (res.ok) {
        setUserPosts(userPosts.filter(p => String(p.id) !== String(postId)))
      } else {
        alert("Could not delete from server.")
      }
    } catch (err) {
      console.error("Failed to delete post:", err)
      alert("Network error. Is the backend server running?")
    }
  }

  if (!isLoaded) return null

  const metadata = user?.unsafeMetadata || {}
  const bio = (metadata.bio as string) || "No bio added yet."
  const website = (metadata.website as string) || ""
  const instagram = (metadata.instagram as string) || ""
  const avatarUrl = (metadata.avatarUrl as string) || user?.imageUrl || "/placeholder-avatar.png"
  const userRole = (metadata.role as string) || role

  return (
    <DashboardLayout role={role}>
      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        user={user} 
      />

      {/* Profile Header */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row items-start gap-8">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white dark:border-neutral-900 shadow-xl bg-neutral-100 dark:bg-neutral-800">
            <Image
              src={avatarUrl}
              alt={user?.fullName || "User"}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 space-y-4 pt-2">
            <div>
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <h1 className="text-3xl font-light tracking-tight">{user?.fullName}</h1>
                <Badge variant="outline" className="rounded-none border-neutral-200 uppercase text-[10px] tracking-widest px-3 py-1">
                  {userRole}
                </Badge>
              </div>
              <p className="text-neutral-400 font-mono text-sm">@{user?.username || user?.emailAddresses[0].emailAddress.split("@")[0]}</p>
            </div>

            <p className="text-neutral-600 dark:text-neutral-400 text-sm max-w-lg leading-relaxed">
              {bio}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
                  <Globe className="h-3 w-3" /> {new URL(website).hostname}
                </a>
              )}
              {instagram && (
                <a href={`https://instagram.com/${instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
                  <Instagram className="h-3 w-3" /> {instagram.startsWith('@') ? instagram : `@${instagram}`}
                </a>
              )}
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={() => setIsEditModalOpen(true)}
                variant="outline" 
                size="sm" 
                className="rounded-none border-neutral-200 dark:border-neutral-800 uppercase tracking-widest text-[10px] h-10 px-6"
              >
                <Settings className="h-3.5 w-3.5 mr-2" />
                Edit Profile
              </Button>
              <Button size="sm" className="rounded-none bg-black text-white hover:bg-neutral-800 uppercase tracking-widest text-[10px] h-10 px-6">
                <Shield className="h-3.5 w-3.5 mr-2" />
                Verification
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-12">
        {[
          { label: "Posts", value: userPosts.length.toString() },
          { label: "Followers", value: "0" },
          { label: "Following", value: "0" },
        ].map((stat) => (
          <div key={stat.label} className="p-6 border border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/50 text-center space-y-1">
            <p className="text-2xl font-light">{stat.value}</p>
            <p className="text-[10px] text-neutral-400 uppercase tracking-[0.2em]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Portfolio Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-4">
          <h3 className="text-sm font-light uppercase tracking-[0.3em] flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Your Work
          </h3>
          <Button variant="ghost" size="sm" className="text-[10px] uppercase tracking-widest text-neutral-400">View All</Button>
        </div>
        
        {isLoadingPosts ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
          </div>
        ) : userPosts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-neutral-200 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-light">No work shared yet.</p>
            <Button 
              variant="link" 
              className="text-[10px] uppercase tracking-widest text-black dark:text-white mt-2"
              onClick={() => router.push(`/dashboard/${role}/feed`)}
            >
              Share your first piece
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {userPosts.map((post) => (
              <div key={post.id} className="relative aspect-square bg-neutral-100 dark:bg-neutral-900 group overflow-hidden">
                <Image
                  src={post.imageUrl}
                  alt={post.description || "Portfolio item"}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 gap-3">
                  <p className="text-[10px] text-white uppercase tracking-[0.4em] font-light text-center line-clamp-2">
                    {post.description || "View Details"}
                  </p>
                  <button 
                    onClick={() => handleDeletePost(post.id)}
                    className="p-2 bg-white/20 hover:bg-red-500/80 text-white rounded-full transition-colors backdrop-blur-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
