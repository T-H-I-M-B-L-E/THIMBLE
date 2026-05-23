"use client"

import { useAuth } from "@/lib/useAuth"
import { DashboardLayout } from "@/components/dashboard-layout"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Globe, Instagram, User, ArrowLeft } from "lucide-react"
import { useFollowing, prefetchComments } from "@/hooks/use-social"
import { useUsers } from "@/hooks/use-users"
import { getSafeHostname, normalizeWebsiteUrl } from "@/lib/platform"
import { PostLightbox } from "@/components/post-lightbox"
import { RoleBadge } from "@/components/role-badge"
import { VerifiedBadge } from "@/components/verified-badge"
import type { PostData } from "@/components/post-card"

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const role = params.role as string
  const userId = params.userId as string
  const { user: currentUser, isLoading: currentUserLoading } = useAuth()
  const [viewedUser, setViewedUser] = useState<any>(null)
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  const [activeTab, setActiveTab] = useState("posts")
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null)
  const { following: userFollowing } = useFollowing(userId)
  const { lookup } = useUsers()

  // If viewing own profile, redirect to the regular profile page
  useEffect(() => {
    if (!currentUserLoading && currentUser && currentUser.id === userId) {
      router.replace(`/dashboard/${role}/profile`)
    }
  }, [currentUserLoading, currentUser, userId, role, router])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Try to get user from the users hook first
        const user = lookup(userId)
        if (user) {
          setViewedUser(user)
          setIsLoadingUser(false)
          return
        }

        // Fallback: Try to fetch from API
        const res = await fetch(`/api/users/${userId}`, {
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          setViewedUser(data)
        } else {
          setViewedUser(null)
        }
      } catch (err) {
        console.error("Failed to fetch user:", err)
        setViewedUser(null)
      } finally {
        setIsLoadingUser(false)
      }
    }
    fetchUserData()
  }, [userId, lookup])

  useEffect(() => {
    if (!viewedUser) return

    const fetchUserPosts = async () => {
      try {
        const res = await fetch("/api/posts", {
          cache: "no-store",
          credentials: "include",
        })

        if (!res.ok) {
          throw new Error(`Failed to fetch posts: ${res.status}`)
        }

        const allPosts = await res.json()
        const filtered = allPosts.filter((p: any) => p.userId === userId)
        setUserPosts(filtered)
      } catch (err) {
        console.error("Failed to fetch user posts:", err)
        setUserPosts([])
      } finally {
        setIsLoadingPosts(false)
      }
    }

    fetchUserPosts()
  }, [viewedUser, userId])

  if (isLoadingUser) {
    return (
      <DashboardLayout role={role} showRail={true}>
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!viewedUser) {
    return (
      <DashboardLayout role={role} showRail={true}>
        <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto", paddingBottom: "40px" }}>
          <button
            onClick={() => router.back()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--t-ink-2)",
              background: "none",
              border: "none",
              cursor: "pointer",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div style={{ textAlign: "center", padding: "60px 16px" }}>
            <p style={{ color: "var(--t-ink-2)" }}>User not found</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const bio = viewedUser.bio || "The vision is yet to be written."
  const website = viewedUser.website || ""
  const instagram: string = ""
  const userRole = viewedUser.role || role
  const websiteHref = normalizeWebsiteUrl(website)
  const websiteHostname = getSafeHostname(website)

  return (
    <DashboardLayout role={role} showRail={true}>
      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto", paddingBottom: "40px" }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--t-ink-2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Profile Header */}
        <div style={{ marginBottom: "32px", display: "flex", gap: "24px", alignItems: "flex-start" }}>
          {/* Avatar */}
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
            }}
          >
            <img
              src={viewedUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewedUser?.fullName || "User")}&background=0D8ABC&color=fff&size=120&rounded=true&bold=true`}
              alt={viewedUser?.fullName || "User"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(viewedUser?.fullName || "User")}&background=0D8ABC&color=fff&size=120&rounded=true&bold=true`
              }}
            />
          </div>

          {/* Meta + Actions */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--t-ink)", margin: "0 0 8px 0", display: "inline-flex", alignItems: "center", gap: 8 }}>
                {viewedUser?.fullName}
                {viewedUser?.isVerified && <VerifiedBadge size={20} />}
              </h1>
              <p style={{ fontSize: "14px", color: "var(--t-ink-2)", margin: "0 0 8px 0" }}>
                @{viewedUser?.email?.split("@")[0]}
              </p>
              <RoleBadge role={userRole} size="sm" />
            </div>

            <p style={{ fontSize: "15px", color: "var(--t-ink-2)", lineHeight: "1.6", margin: 0 }}>
              {bio}
            </p>

            {/* Links */}
            {(website || instagram) && (
              <div className="t-profile-links">
                {website && (
                  <span>
                    <Globe size={13} />
                    <a href={websiteHref} target="_blank" rel="noopener noreferrer">{websiteHostname || website}</a>
                  </span>
                )}
                {instagram && (
                  <span>
                    <Instagram size={13} />
                    <a href={`https://instagram.com/${instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                      {instagram.startsWith("@") ? instagram : `@${instagram}`}
                    </a>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="t-profile-stats">
          <div>
            <div className="t-stat-big">{userPosts.length}</div>
            <div className="t-stat-lbl">Works</div>
          </div>
          <div style={{ cursor: "pointer" }} onClick={() => setActiveTab("following")}>
            <div className="t-stat-big">{userFollowing.length}</div>
            <div className="t-stat-lbl">Following</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="t-profile-tabs">
          {["posts", "following"].map((tab) => (
            <button
              key={tab}
              className={`t-tab ${activeTab === tab ? "on" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Portfolio Grid */}
        {activeTab === "posts" && (
          <div style={{ marginTop: "20px" }}>
            {isLoadingPosts ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
              </div>
            ) : userPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "2px dashed var(--t-line)", borderRadius: "12px" }}>
                <p style={{ color: "var(--t-ink-2)" }}>No works published yet</p>
              </div>
            ) : (
              <div className="t-profile-grid">
                {userPosts.map((post) => (
                  <button
                    key={post.id}
                    className="t-grid-item"
                    onClick={() => {
                      prefetchComments(post.id)
                      setSelectedPost(post)
                    }}
                    style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
                  >
                    <img src={post.imageUrl} alt={post.description || "Work"} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Following Tab */}
        {activeTab === "following" && (
          <div style={{ marginTop: "20px" }}>
            {userFollowing.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "2px dashed var(--t-line)", borderRadius: "12px" }}>
                <p style={{ color: "var(--t-ink-2)" }}>Not following anyone</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {userFollowing.map(u => (
                  <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 4px", borderBottom: "1px solid var(--t-line)" }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                      background: "var(--t-gold-soft)", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 600, color: "var(--t-gold-ink)"
                    }}>
                      {u.userAvatar
                        ? <img src={u.userAvatar} alt={u.userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (u.userName?.[0]?.toUpperCase() ?? <User size={20} />)
                      }
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t-ink)" }}>{u.userName}</p>
                      {u.role && <p style={{ fontSize: 12, color: "var(--t-ink-3)", textTransform: "capitalize" }}>{u.role}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lightbox Modal */}
        {selectedPost && (
          <PostLightbox
            post={selectedPost}
            isOpen={!!selectedPost}
            onClose={() => setSelectedPost(null)}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
