"use client"

import { useStore } from "@/lib/store"
import { useUser } from "@clerk/nextjs"
import Image from "next/image"
import { Heart, MessageSquare, Bookmark, Share2, Plus, MoreHorizontal, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CreatePostModal } from "@/components/create-post-modal"

interface Post {
  id: number
  userId: string
  authorName: string
  authorAvatar: string
  imageUrl: string
  description: string
  likes: number
  createdAt: string
}

export function FeedView() {
  const { user: clerkUser } = useUser()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/posts")
      const data = await res.json()
      setPosts(data)
    } catch (err) {
      console.error("Failed to fetch posts:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return
    
    try {
      const res = await fetch(`http://localhost:3001/api/posts/${postId}`, {
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
      alert("Network error: Is the backend server running?")
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-fade-in pb-20">
    <CreatePostModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSuccess={fetchPosts}
      user={clerkUser}
    />

    {/* Create Post Action */}
    <div className="p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black flex items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-neutral-100 dark:border-neutral-900 flex-shrink-0">
          <Image
            src={(clerkUser?.unsafeMetadata?.avatarUrl as string) || clerkUser?.imageUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"}
            alt="Me"
            fill
            className="object-cover"
          />
        </div>
        <p className="text-sm text-neutral-400 truncate">What's on your mind?</p>
      </div>
      <Button 
        onClick={() => setIsModalOpen(true)}
        size="sm"
        className="rounded-none bg-black text-white hover:bg-neutral-800 transition-soft flex items-center gap-2 px-4 h-9 sm:h-10 text-xs sm:text-sm"
      >
        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
        Post
      </Button>
    </div>

    {isLoading ? (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
      </div>
    ) : posts.length === 0 ? (
      <div className="text-center py-20 text-neutral-500 border border-neutral-200 dark:border-neutral-800">
        No posts yet. Be the first to share!
      </div>
    ) : (
      posts.map((post) => (
        <Card key={post.id} className="rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black overflow-hidden">
          {/* Post Header */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-neutral-100 dark:border-neutral-900">
                <Image
                  src={
                    (clerkUser?.id === post.userId)
                      ? ((clerkUser?.unsafeMetadata?.avatarUrl as string) || clerkUser?.imageUrl)
                      : (post.authorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop")
                  }
                  alt={post.authorName}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="text-sm font-medium">{post.authorName}</h3>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Creator</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {clerkUser?.id === post.userId && (
                <button 
                  onClick={() => handleDelete(post.id)}
                  className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <Button variant="ghost" size="icon" className="text-neutral-400">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Post Image */}
          <div className="relative aspect-square bg-neutral-50 dark:bg-neutral-900">
            <Image
              src={post.imageUrl}
              alt={post.description}
              fill
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>

          {/* Post Actions */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button className="text-neutral-600 dark:text-neutral-400 hover:text-red-500 transition-colors">
                  <Heart className="h-6 w-6" />
                </button>
                <button className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                  <MessageSquare className="h-6 w-6" />
                </button>
                <button className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                  <Share2 className="h-6 w-6" />
                </button>
              </div>
              <button className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                <Bookmark className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{post.likes} likes</p>
              <p className="text-sm">
                <span className="font-medium mr-2">{post.authorName}</span>
                <span className="text-neutral-600 dark:text-neutral-400">{post.description}</span>
              </p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest pt-2">
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>
      ))
    )}
  </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}
