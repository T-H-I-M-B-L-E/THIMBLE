"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { BottomNav } from "@/components/bottom-nav"
import { Sidebar } from "@/components/sidebar"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"

const explorePosts = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&h=600&fit=crop",
    author: "Elena Moreau",
    likes: 2847,
    category: "Fashion",
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=600&fit=crop",
    author: "Marcus Chen",
    likes: 4521,
    category: "Editorial",
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=600&fit=crop",
    author: "Sofia Laurent",
    likes: 8934,
    category: "Campaign",
  },
  {
    id: "4",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=600&fit=crop",
    author: "Adrian Voss",
    likes: 3267,
    category: "Photography",
  },
  {
    id: "5",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=600&fit=crop",
    author: "Luna Designs",
    likes: 5621,
    category: "Fashion",
  },
  {
    id: "6",
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=600&fit=crop",
    author: "Harper Studio",
    likes: 1892,
    category: "Street Style",
  },
  {
    id: "7",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=600&fit=crop",
    author: "Vibe Collective",
    likes: 7234,
    category: "Minimal",
  },
  {
    id: "8",
    image: "https://images.unsplash.com/photo-1485968579169-a6e9dc7c057c?w=600&h=600&fit=crop",
    author: "Atelier Mode",
    likes: 4456,
    category: "Haute Couture",
  },
  {
    id: "9",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop",
    author: "Studio Noir",
    likes: 2891,
    category: "Editorial",
  },
]

const categories = ["All", "Fashion", "Editorial", "Photography", "Street Style", "Minimal", "Haute Couture"]

export default function ExplorePage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/auth")
    }
  }, [user, isLoaded, router])

  const filteredPosts = explorePosts.filter((post) => {
    const matchesSearch = post.author.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (!isLoaded) {
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
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">Explore</h1>
          </div>
        </header>

        {/* Search Section */}
        <div className="mx-auto max-w-xl sm:max-w-2xl px-3 sm:px-4 py-3 sm:py-4 lg:border-r lg:border-border space-y-3 sm:space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search creators, styles, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 sm:h-11 pl-10 text-sm sm:text-base bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:-mx-0 sm:px-0">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap text-xs sm:text-sm ${
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-secondary"
                }`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Grid Content */}
        <div className="mx-auto max-w-xl sm:max-w-2xl px-0 sm:px-4 pb-4 lg:border-r lg:border-border">
          <div className="grid grid-cols-3 gap-0.5 sm:gap-1 md:gap-2">
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="relative aspect-square group overflow-hidden"
              >
                <Image
                  src={post.image}
                  alt={`Post by ${post.author}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                />
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white">
                  <p className="font-medium text-xs sm:text-sm">{post.likes.toLocaleString()} likes</p>
                  <p className="text-xs text-white/80 hidden sm:block">@{post.author}</p>
                </div>
              </Link>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts found</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
