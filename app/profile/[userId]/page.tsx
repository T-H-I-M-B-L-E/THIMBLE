"use client"

import { useAuth } from "@/lib/useAuth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useRouter, useParams } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Globe, Instagram, User, ArrowLeft } from "lucide-react"
import { useFollowing, prefetchComments } from "@/hooks/use-social"
import { useInfinite } from "@/hooks/use-infinite"
import { useUsers } from "@/hooks/use-users"
import { getSafeHostname, normalizeWebsiteUrl } from "@/lib/platform"
import { PostLightbox } from "@/components/post-lightbox"
import { RoleBadge } from "@/components/role-badge"
import { VerifiedBadge } from "@/components/verified-badge"
import type { PostData } from "@/components/post-card"

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const { user: currentUser, isLoading: currentUserLoading } = useAuth()
  const [viewedUser, setViewedUser] = useState<any>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [activeTab, setActiveTab] = useState("posts")
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null)
  const { following: userFollowing } = useFollowing(userId)
  const { lookup } = useUsers()

  const PAGE_SIZE = 20
  const fetchUserPosts = useCallback(
    async (cursor: string | null) => {
      const params = new URLSearchParams()
      params.set("userId", userId)
      if (cursor) params.set("before", cursor)
      const res = await fetch(`/api/posts?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`)
      const raw = await res.json()
      const arr: PostData[] = (Array.isArray(raw) ? raw : []).map((item: any) =>
        item?.type === "post" ? item.data : item
      )
      return {
        items: arr,
        nextCursor: arr.length === PAGE_SIZE ? String(arr[arr.length - 1].id) : null,
      }
    },
    [userId],
  )
  const userPostsState = useInfinite<PostData>(fetchUserPosts, [userId], !!viewedUser)

  useEffect(() => {
    if (!currentUserLoading && currentUser && currentUser.id === userId) {
      router.replace(`/profile`)
    }
  }, [currentUserLoading, currentUser, userId, router])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = lookup(userId)
        if (user) {
          setViewedUser(user)
          setIsLoadingUser(false)
          return
        }

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
    void fetchUserData()
  }, [userId, lookup])

  if (isLoadingUser) {
    return (
      <DashboardLayout showRail={true}>
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!viewedUser) {
    return (
      <DashboardLayout showRail={true}>
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

  const hasMedia = (p: any) => !!p.imageUrl || (Array.isArray(p.images) && p.images.length > 0)
  const visualPosts = userPostsState.items.filter(hasMedia)

  const bio = viewedUser.bio || "The vision is yet to be written."
  const website = viewedUser.website || ""
  const instagram = ((viewedUser as any).instagram || "").trim()
  const userRole = viewedUser.role || "designer"
  const websiteHref = normalizeWebsiteUrl(website)
  const websiteHostname = getSafeHostname(website)

  return (
    <DashboardLayout showRail={true}>
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

        <div style={{ marginBottom: "32px", display: "flex", gap: "24px", alignItems: "flex-start" }}>
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

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--t-ink)", margin: "0 0 8px 0", display: "inline-flex", alignItems: "center", gap: 8 }}>
                {viewedUser?.fullName}
                {viewedUser?.isVerified && <VerifiedBadge size={20} />}
              </h1>
              <p style={{ fontSize: "14px", color: "var(--t-ink-2)", margin: "0 0 8px 0" }}>
                @{viewedUser?.username || viewedUser?.email?.split("@")[0]}
              </p>
              <RoleBadge role={userRole} size="sm" />
            </div>

            <p style={{ fontSize: "15px", color: "var(--t-ink-2)", lineHeight: "1.6", margin: 0 }}>
              {bio}
            </p>

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

        <div className="t-profile-stats">
          <div>
            <div className="t-stat-big">{visualPosts.length}</div>
            <div className="t-stat-lbl">Works</div>
          </div>
          <div style={{ cursor: "pointer" }} onClick={() => setActiveTab("following")}>
            <div className="t-stat-big">{userFollowing.length}</div>
            <div className="t-stat-lbl">Following</div>
          </div>
        </div>

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

        {activeTab === "posts" && (
          <div style={{ marginTop: "20px" }}>
            {userPostsState.isLoading && visualPosts.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
              </div>
            ) : visualPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "2px dashed var(--t-line)", borderRadius: "12px" }}>
                <p style={{ color: "var(--t-ink-2)" }}>No works published yet</p>
              </div>
            ) : (
              <>
                <div className="t-profile-grid">
                  {visualPosts.map((post) => (
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
                {userPostsState.hasMore && (
                  <div ref={userPostsState.sentinelRef} className="t-feed-sentinel" aria-hidden="true" />
                )}
                {userPostsState.isLoadingMore && (
                  <div className="t-feed-loading-more">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2" style={{ borderColor: "var(--t-gold)" }} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
