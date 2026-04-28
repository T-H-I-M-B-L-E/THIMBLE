"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Heart, MessageCircle, Bookmark, MoreHorizontal } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PostCardProps {
  id: string
  author: {
    name: string
    username: string
    avatar: string
    role: string
  }
  image: string
  description: string
  likes: number
  comments: number
  timeAgo: string
}

export function PostCard({
  author,
  image,
  description,
  likes,
  comments,
  timeAgo,
}: PostCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [likeCount, setLikeCount] = useState(likes)

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1)
  }

  return (
    <article className="bg-card sm:rounded-xl border-0 sm:border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        <Link href="/profile" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border border-border flex-shrink-0">
            <AvatarImage src={author.avatar} alt={author.name} />
            <AvatarFallback className="bg-secondary text-foreground text-sm">
              {author.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{author.name}</p>
            <p className="text-xs text-muted-foreground">{author.role}</p>
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground flex-shrink-0">
          <MoreHorizontal className="h-5 w-5" />
          <span className="sr-only">More options</span>
        </Button>
      </div>

      {/* Image */}
      <div className="relative aspect-[4/5] sm:aspect-[4/5] w-full bg-secondary">
        <Image
          src={image}
          alt={description}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 500px, 600px"
          priority
        />
      </div>

      {/* Actions */}
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "p-0 h-8 w-8 sm:h-auto sm:w-auto",
                isLiked ? "text-red-500 hover:text-red-600" : "text-foreground hover:text-primary"
              )}
              onClick={handleLike}
            >
              <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
              <span className="sr-only">Like</span>
            </Button>
            <Button variant="ghost" size="icon" className="p-0 h-8 w-8 sm:h-auto sm:w-auto text-foreground hover:text-primary">
              <MessageCircle className="h-6 w-6" />
              <span className="sr-only">Comment</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "p-0 h-8 w-8 sm:h-auto sm:w-auto",
              isSaved ? "text-primary" : "text-foreground hover:text-primary"
            )}
            onClick={() => setIsSaved(!isSaved)}
          >
            <Bookmark className={cn("h-6 w-6", isSaved && "fill-current")} />
            <span className="sr-only">Save</span>
          </Button>
        </div>

        {/* Stats */}
        <p className="text-sm font-medium text-foreground mb-1 sm:mb-2">
          {likeCount.toLocaleString()} likes
        </p>

        {/* Description */}
        <p className="text-sm text-foreground">
          <Link href="/profile" className="font-medium hover:underline mr-1.5 sm:mr-2">
            {author.username}
          </Link>
          <span className="text-muted-foreground">{description}</span>
        </p>

        {/* Comments preview */}
        {comments > 0 && (
          <button className="text-sm text-muted-foreground mt-1.5 sm:mt-2 hover:text-foreground transition-colors">
            View all {comments} comments
          </button>
        )}

        {/* Time */}
        <p className="text-xs text-muted-foreground mt-1.5 sm:mt-2 uppercase tracking-wider">
          {timeAgo}
        </p>
      </div>
    </article>
  )
}
