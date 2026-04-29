"use client"

import { useStore } from "@/lib/store"
import Image from "next/image"
import { Heart, MessageCircle, Bookmark, Share2, CheckCircle } from "lucide-react"
import { useState } from "react"

export function FeedView() {
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
    <div className="max-w-xl mx-auto space-y-6">
      {designPosts.map((post) => (
        <div
          key={post.id}
          className="bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800"
        >
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
            {post.authorVerified && (
              <CheckCircle className="h-4 w-4 text-amber-500 fill-amber-500" />
            )}
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
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`transition-colors ${
                    likedPosts.has(post.id)
                      ? "text-red-500"
                      : "text-neutral-600 hover:text-red-500"
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
                  savedPosts.has(post.id)
                    ? "text-black dark:text-white"
                    : "text-neutral-600 hover:text-neutral-900"
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
              <span className="text-neutral-600 dark:text-neutral-400">
                {post.description}
              </span>
            </p>

            {/* Tags */}
            {post.tags && (
              <p className="text-sm text-neutral-500 mt-2">
                {post.tags.join(" ")}
              </p>
            )}

            {/* Time */}
            <p className="text-xs text-neutral-400 mt-2 uppercase tracking-wider">
              {post.createdAt}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
