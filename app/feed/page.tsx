"use client"

import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

export default function FeedPage() {
  const { designPosts, user } = useStore()
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const toggleSave = (postId: string) => {
    setSavedPosts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-black/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-light tracking-[0.2em]">
            THIMBLE
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={`/dashboard/${user.role}`}>
                <img
                  src={user.avatar}
                  alt={user.fullName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              </Link>
            ) : (
              <Link href="/auth">
                <Button size="sm" className="rounded-none bg-black text-white">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="max-w-2xl mx-auto">
        {designPosts.map((post) => (
          <Card key={post.id} className="rounded-none border-0 border-b border-neutral-200 dark:border-neutral-800">
            {/* Post Header */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <img
                  src={post.authorAvatar}
                  alt={post.author}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-sm">{post.author}</p>
                  <p className="text-xs text-neutral-500 capitalize">{post.authorRole}</p>
                </div>
              </div>
            </div>

            {/* Post Image */}
            <div className="relative aspect-[4/5] w-full">
              <Image
                src={post.image}
                alt={post.description}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
              />
            </div>

            {/* Actions */}
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`transition-colors ${
                      likedPosts.has(post.id) ? "text-red-500" : "text-neutral-600 hover:text-red-500"
                    }`}
                  >
                    <Heart
                      className="h-6 w-6"
                      fill={likedPosts.has(post.id) ? "currentColor" : "none"}
                    />
                  </button>
                  <button className="text-neutral-600 hover:text-neutral-900">
                    <MessageCircle className="h-6 w-6" />
                  </button>
                  <button className="text-neutral-600 hover:text-neutral-900">
                    <Share2 className="h-6 w-6" />
                  </button>
                </div>
                <button
                  onClick={() => toggleSave(post.id)}
                  className={`transition-colors ${
                    savedPosts.has(post.id) ? "text-black dark:text-white" : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Bookmark
                    className="h-6 w-6"
                    fill={savedPosts.has(post.id) ? "currentColor" : "none"}
                  />
                </button>
              </div>

              {/* Likes */}
              <p className="font-medium text-sm mb-2">
                {post.likes + (likedPosts.has(post.id) ? 1 : 0)} likes
              </p>

              {/* Description */}
              <p className="text-sm">
                <span className="font-medium">{post.author}</span>{" "}
                <span className="text-neutral-600 dark:text-neutral-400">{post.description}</span>
              </p>

              {/* Time */}
              <p className="text-xs text-neutral-400 mt-2 uppercase tracking-wider">
                {post.createdAt}
              </p>
            </CardContent>
          </Card>
        ))}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-black/95 backdrop-blur-sm lg:hidden">
        <div className="max-w-md mx-auto flex h-16 items-center justify-around">
          <Link href="/feed" className="flex flex-col items-center gap-1 p-2 text-black dark:text-white">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.1L2 9.6v12.3h8v-7h4v7h8V9.6L12 2.1z" />
            </svg>
            <span className="text-[10px]">Feed</span>
          </Link>
          <Link href="/explore" className="flex flex-col items-center gap-1 p-2 text-neutral-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[10px]">Explore</span>
          </Link>
          <Link href={user ? `/dashboard/${user.role}` : "/auth"} className="flex flex-col items-center gap-1 p-2 text-neutral-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px]">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
