"use client"

import { useStore } from "@/lib/store"
import { useUser } from "@clerk/nextjs"
import Image from "next/image"
import { Heart, MessageSquare, Bookmark, Share2, Plus, MoreHorizontal, Trash2, ArrowUpRight } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CreatePostModal } from "@/components/create-post-modal"
import { motion, AnimatePresence } from "framer-motion"
import { getApiUrl } from "@/lib/platform"

interface Post {
  id: number | string
  userId?: string
  authorName: string
  authorAvatar: string
  imageUrl: string
  description: string
  likes: number
  createdAt: string
}

export function FeedView() {
  const { user: clerkUser } = useUser()
  const { designPosts, removeDesignPost } = useStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    const postsUrl = getApiUrl("/api/posts")

    if (!postsUrl) {
      setPosts(
        designPosts.map((post) => ({
          id: post.id,
          userId: post.userId,
          authorName: post.author,
          authorAvatar: post.authorAvatar || "",
          imageUrl: post.image,
          description: post.description,
          likes: post.likes,
          createdAt: post.createdAt,
        }))
      )
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(postsUrl)
      const data = await res.json()
      setPosts(data)
    } catch (err) {
      console.error("Failed to fetch posts:", err)
      setPosts(
        designPosts.map((post) => ({
          id: post.id,
          userId: post.userId,
          authorName: post.author,
          authorAvatar: post.authorAvatar || "",
          imageUrl: post.image,
          description: post.description,
          likes: post.likes,
          createdAt: post.createdAt,
        }))
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (postId: number | string) => {
    if (!confirm("Are you sure you want to delete this post?")) return

    const postsUrl = getApiUrl(`/api/posts/${postId}`)
    
    if (!postsUrl) {
      removeDesignPost(String(postId))
      setPosts(posts.filter(p => String(p.id) !== String(postId)))
      return
    }

    try {
      const res = await fetch(postsUrl, {
        method: "DELETE"
      })
      if (res.ok) {
        setPosts(posts.filter(p => String(p.id) !== String(postId)))
      } else {
        const error = await res.json()
        alert("Failed to delete: " + (error.error || "Unknown error"))
      }
    } catch (err) {
      console.error("Failed to delete post:", err)
      alert("Network error. This action needs a live backend connection.")
    }
  }

  return (
    <div className="max-w-screen-md mx-auto space-y-12 pb-24 px-4 sm:px-6">
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPosts}
        user={clerkUser}
      />

      {/* Luxury Create Post Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/20 shrink-0">
            <Image
              src={(clerkUser?.unsafeMetadata?.avatarUrl as string) || clerkUser?.imageUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"}
              alt="Me"
              fill
              className="object-cover"
            />
          </div>
          <p className="text-sm font-light text-neutral-400 italic truncate">Share your latest vision...</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto rounded-none bg-black text-white hover:bg-neutral-800 transition-soft flex items-center justify-center gap-3 px-8 h-12 text-xs uppercase tracking-[0.2em]"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Create
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-black dark:border-white"></div>
          <p className="text-luxury text-neutral-400">Curating Feed</p>
        </div>
      ) : (
        <div className="space-y-24">
          <AnimatePresence mode="popLayout">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group relative"
              >
                {/* Post Header (Floating Editorial Style) */}
                <div className="flex items-end justify-between mb-6 px-2">
                  <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border border-neutral-100 dark:border-neutral-900 ring-offset-4 ring-1 ring-neutral-200 dark:ring-neutral-800">
                      <Image
                        src={
                          (clerkUser?.id === post.userId)
                            ? ((clerkUser?.unsafeMetadata?.avatarUrl as string) || clerkUser?.imageUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop")
                            : (post.authorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop")
                        }
                        alt={post.authorName}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif tracking-tight leading-none mb-1">{post.authorName}</h3>
                      <p className="text-luxury text-neutral-400">Verified Creator</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {clerkUser?.id === post.userId && (
                      <button 
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-neutral-300 hover:text-red-500 transition-soft"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button className="p-2 text-neutral-300 hover:text-black dark:hover:text-white transition-soft">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Hero Image Section */}
                <div className="relative aspect-[4/5] overflow-hidden bg-neutral-50 dark:bg-neutral-950">
                  <Image
                    src={post.imageUrl}
                    alt={post.description}
                    fill
                    className="object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
                    priority={index < 2}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  
                  {/* Floating Action Button */}
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute bottom-8 right-8 w-14 h-14 glass flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-2xl"
                  >
                    <ArrowUpRight className="h-6 w-6" />
                  </motion.button>
                </div>

                {/* Editorial Description */}
                <div className="mt-8 px-2 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                    <p className="text-lg font-light text-neutral-600 dark:text-neutral-300 max-w-xl leading-relaxed italic">
                      "{post.description}"
                    </p>
                    <div className="flex gap-4 sm:gap-6 self-start">
                      <button className="group/btn flex flex-col items-center justify-center gap-2 min-w-[44px] min-h-[44px]">
                        <Heart className="h-6 w-6 text-neutral-400 group-hover/btn:text-red-500 transition-colors" />
                        <span className="text-[10px] font-mono text-neutral-400">{post.likes}</span>
                      </button>
                      <button className="group/btn flex flex-col items-center justify-center gap-2 min-w-[44px] min-h-[44px]">
                        <MessageSquare className="h-6 w-6 text-neutral-400 group-hover/btn:text-black dark:group-hover/btn:white transition-colors" />
                        <span className="text-[10px] font-mono text-neutral-400">12</span>
                      </button>
                    </div>
                  </div>

                  <div className="h-px w-12 bg-neutral-200 dark:bg-neutral-800" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                      Published {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <button className="text-luxury text-neutral-500 hover:text-black dark:hover:text-white transition-soft flex items-center gap-2 min-h-[44px] self-start sm:self-auto">
                      Full Editorial <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
