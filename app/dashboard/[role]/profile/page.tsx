"use client"

import { useUser } from "@clerk/nextjs"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Grid3X3, Settings, Shield, Globe, Instagram, Trash2, ArrowUpRight } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { EditProfileModal } from "@/components/edit-profile-modal"
import { motion } from "framer-motion"
import { useStore } from "@/lib/store"
import { getApiUrl, getSafeHostname, normalizeWebsiteUrl } from "@/lib/platform"

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const role = params.role as string
  const { user, isLoaded } = useUser()
  const { designPosts } = useStore()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)

  useEffect(() => {
    if (isLoaded && user) {
      fetchUserPosts()
    }
  }, [isLoaded, user])

  const fetchUserPosts = async () => {
    const postsUrl = getApiUrl("/api/posts")

    if (!postsUrl) {
      const fallbackPosts = designPosts.filter((post) => post.userId === user?.id)
      setUserPosts(
        fallbackPosts.map((post) => ({
          id: post.id,
          imageUrl: post.image,
          description: post.description,
        }))
      )
      setIsLoadingPosts(false)
      return
    }

    try {
      const res = await fetch(postsUrl)
      const allPosts = await res.json()
      const filtered = allPosts.filter((p: any) => p.userId === user?.id)
      setUserPosts(filtered)
    } catch (err) {
      console.error("Failed to fetch user posts:", err)
      const fallbackPosts = designPosts.filter((post) => post.userId === user?.id)
      setUserPosts(
        fallbackPosts.map((post) => ({
          id: post.id,
          imageUrl: post.image,
          description: post.description,
        }))
      )
    } finally {
      setIsLoadingPosts(false)
    }
  }

  const handleDeletePost = async (postId: number | string) => {
    if (!confirm("Remove this piece from your portfolio?")) return

    const deleteUrl = getApiUrl(`/api/posts/${postId}`)

    if (!deleteUrl) {
      setUserPosts(userPosts.filter(p => String(p.id) !== String(postId)))
      return
    }
    
    try {
      const res = await fetch(deleteUrl, {
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
  const bio = (metadata.bio as string) || "The vision is yet to be written."
  const website = (metadata.website as string) || ""
  const instagram = (metadata.instagram as string) || ""
  const avatarUrl = (metadata.avatarUrl as string) || user?.imageUrl || "/placeholder-avatar.png"
  const userRole = (metadata.role as string) || role
  const websiteHref = normalizeWebsiteUrl(website)
  const websiteHostname = getSafeHostname(website)

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any } }
  }

  return (
    <DashboardLayout role={role}>
      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        user={user} 
      />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-screen-lg mx-auto pb-24"
      >
        {/* Profile Header - Comp Card Style */}
        <motion.div variants={itemVariants} className="mb-16">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-16">
            <div className="relative w-40 h-40 md:w-56 md:h-56 rounded-none overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-2xl flex-shrink-0">
              <Image
                src={avatarUrl}
                alt={user?.fullName || "User"}
                fill
                className="object-cover transition-transform duration-1000 hover:scale-105"
                priority
              />
            </div>
            
            <div className="flex-1 space-y-6 text-center md:text-left">
              <div>
                <p className="text-luxury text-neutral-400 mb-4">{userRole}</p>
                <h1 className="text-4xl md:text-6xl font-serif tracking-tight mb-2 leading-none">{user?.fullName}</h1>
                <p className="font-mono text-sm text-neutral-500">@{user?.username || user?.emailAddresses[0].emailAddress.split("@")[0]}</p>
              </div>

              <div className="w-12 h-px bg-black dark:bg-white mx-auto md:mx-0" />

              <p className="text-lg font-light text-neutral-600 dark:text-neutral-300 max-w-xl leading-relaxed mx-auto md:mx-0 italic">
                "{bio}"
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-6 pt-2">
                {website && (
                  <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-500 hover:text-black dark:hover:text-white transition-soft group">
                    <Globe className="h-3.5 w-3.5" /> 
                    <span className="border-b border-transparent group-hover:border-current pb-0.5 transition-colors">{websiteHostname || website}</span>
                  </a>
                )}
                {instagram && (
                  <a href={`https://instagram.com/${instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-500 hover:text-black dark:hover:text-white transition-soft group">
                    <Instagram className="h-3.5 w-3.5" /> 
                    <span className="border-b border-transparent group-hover:border-current pb-0.5 transition-colors">{instagram.startsWith('@') ? instagram : `@${instagram}`}</span>
                  </a>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-4 pt-6 w-full sm:w-auto">
                <Button 
                  onClick={() => setIsEditModalOpen(true)}
                  variant="outline" 
                  className="w-full sm:w-auto rounded-none border-neutral-300 dark:border-neutral-700 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900 text-luxury h-12 px-8 transition-soft"
                >
                  <Settings className="h-3.5 w-3.5 mr-3" />
                  Edit Editorial
                </Button>
                <Button className="w-full sm:w-auto rounded-none bg-black text-white hover:bg-neutral-800 text-luxury h-12 px-8 transition-soft">
                  <Shield className="h-3.5 w-3.5 mr-3" />
                  Get Verified
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats - Minimalist */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-px bg-neutral-200 dark:bg-neutral-800 mb-12 sm:mb-20 border border-neutral-200 dark:border-neutral-800">
          {[
            { label: "Editorials", value: userPosts.length.toString() },
            { label: "Followers", value: "0" },
            { label: "Following", value: "0" },
          ].map((stat) => (
            <div key={stat.label} className="py-6 sm:py-10 bg-white dark:bg-black text-center space-y-2 sm:space-y-3 group hover:bg-neutral-50 dark:hover:bg-neutral-950 transition-colors">
              <p className="text-2xl sm:text-4xl font-light">{stat.value}</p>
              <p className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Portfolio Grid - Masonry/Editorial Style */}
        <motion.div variants={itemVariants} className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black dark:border-white pb-6">
            <h3 className="font-serif text-2xl tracking-wide text-center sm:text-left">Selected Works</h3>
            <Button variant="ghost" className="text-luxury text-neutral-500 hover:text-black dark:hover:text-white transition-soft w-full sm:w-auto">
              View Archive <ArrowUpRight className="h-3 w-3 ml-2" />
            </Button>
          </div>
          
          {isLoadingPosts ? (
            <div className="flex justify-center py-32">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-black dark:border-white"></div>
            </div>
          ) : userPosts.length === 0 ? (
            <div className="text-center py-32 border border-dashed border-neutral-300 dark:border-neutral-700">
              <p className="font-serif text-xl text-neutral-400 mb-4">The canvas is blank.</p>
              <Button 
                variant="link" 
                className="text-luxury text-black dark:text-white"
                onClick={() => router.push(`/dashboard/${role}/feed`)}
              >
                Publish Your First Piece
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {userPosts.map((post, index) => (
                <motion.div 
                  key={post.id} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative aspect-[4/5] bg-neutral-100 dark:bg-neutral-900 group overflow-hidden"
                >
                  <Image
                    src={post.imageUrl}
                    alt={post.description || "Portfolio item"}
                    fill
                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                    <p className="text-luxury text-white mb-4 line-clamp-2">
                      {post.description || "Untitled piece"}
                    </p>
                    <div className="flex justify-end">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePost(post.id);
                        }}
                        className="p-3 bg-white/10 hover:bg-red-500 text-white rounded-full transition-colors backdrop-blur-md"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </DashboardLayout>
  )
}
