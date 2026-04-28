"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { BottomNav } from "@/components/bottom-nav"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Grid3X3, Bookmark, Settings, LogOut, MapPin, Link as LinkIcon } from "lucide-react"
import { useEffect } from "react"

const userPosts = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&h=600&fit=crop",
    likes: 2847,
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=600&fit=crop",
    likes: 4521,
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=600&fit=crop",
    likes: 8934,
  },
  {
    id: "4",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=600&fit=crop",
    likes: 3267,
  },
  {
    id: "5",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=600&fit=crop",
    likes: 5621,
  },
  {
    id: "6",
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=600&fit=crop",
    likes: 1892,
  },
]

const savedPosts = [
  {
    id: "7",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=600&fit=crop",
    likes: 7234,
  },
  {
    id: "8",
    image: "https://images.unsplash.com/photo-1485968579169-a6e9dc7c057c?w=600&h=600&fit=crop",
    likes: 4456,
  },
  {
    id: "9",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop",
    likes: 2891,
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth")
    }
  }, [user, isLoading, router])

  const handleLogout = () => {
    logout()
    router.push("/auth")
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
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">Profile</h1>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 text-foreground">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 sm:h-10 sm:w-10 text-foreground">
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Profile Content */}
        <div className="mx-auto max-w-xl sm:max-w-2xl lg:border-r lg:border-border">
          {/* Profile Header */}
          <div className="px-3 sm:px-4 py-4 sm:py-6 border-b border-border">
            <div className="flex items-start gap-3 sm:gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-border flex-shrink-0">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-secondary text-foreground text-xl sm:text-2xl">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate">{user.name}</h2>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
                <p className="text-xs sm:text-sm text-primary mt-0.5">{user.role || "Creative"}</p>
              </div>
            </div>

            {/* Bio */}
            <div className="mt-3 sm:mt-4 space-y-2">
              <p className="text-foreground text-sm">
                {user.bio || "Fashion designer & creative director. Exploring the intersection of art and fashion."}
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Paris, France
                </span>
                <Link href="#" className="flex items-center gap-1 text-primary hover:underline">
                  <LinkIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  portfolio.com
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 sm:gap-6 mt-3 sm:mt-4 py-3 sm:py-4 border-t border-border">
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm sm:text-base">{userPosts.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Posts</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm sm:text-base">12.4K</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm sm:text-base">892</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Following</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3 mt-2">
              <Button
                variant={isFollowing ? "outline" : "default"}
                className="flex-1 h-9 sm:h-10 text-sm"
                onClick={() => setIsFollowing(!isFollowing)}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button variant="outline" className="flex-1 h-9 sm:h-10 text-sm">
                Message
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none bg-transparent border-b border-border h-11 sm:h-12">
              <TabsTrigger
                value="posts"
                className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs sm:text-sm"
              >
                <Grid3X3 className="h-4 w-4 mr-1.5 sm:mr-2" />
                Posts
              </TabsTrigger>
              <TabsTrigger
                value="saved"
                className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs sm:text-sm"
              >
                <Bookmark className="h-4 w-4 mr-1.5 sm:mr-2" />
                Saved
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-0">
              <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
                {userPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="relative aspect-square group overflow-hidden"
                  >
                    <Image
                      src={post.image}
                      alt="Post"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs sm:text-sm font-medium">
                      {post.likes.toLocaleString()} likes
                    </div>
                  </Link>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="saved" className="mt-0">
              <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
                {savedPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="relative aspect-square group overflow-hidden"
                  >
                    <Image
                      src={post.image}
                      alt="Saved post"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs sm:text-sm font-medium">
                      {post.likes.toLocaleString()} likes
                    </div>
                  </Link>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
