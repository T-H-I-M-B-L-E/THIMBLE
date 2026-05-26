"use client"

import { useAuth } from "@/lib/useAuth"
import { useNotify } from "@/components/notify-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { EditProfileModal } from "@/components/edit-profile-modal"
import { VerificationModal } from "@/components/verification-modal"
import { VerifiedBadge } from "@/components/verified-badge"
import { getSafeHostname, normalizeWebsiteUrl } from "@/lib/platform"
import { Globe, Instagram, Settings, Shield, User } from "lucide-react"
import { useFollowing, prefetchComments } from "@/hooks/use-social"
import { PostLightbox } from "@/components/post-lightbox"
import { RoleBadge } from "@/components/role-badge"
import type { PostData } from "@/components/post-card"

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading, refresh } = useAuth()
  const notify = useNotify()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [savedPosts, setSavedPosts] = useState<any[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [activeTab, setActiveTab] = useState("posts")
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null)
  const { following, isLoading: loadingFollowing } = useFollowing(user?.id)

  useEffect(() => {
    if (!isLoading && user) {
      fetchUserPosts()
    }
  }, [isLoading, user])

  const fetchSavedPosts = async () => {
    setIsLoadingSaved(true)
    try {
      const res = await fetch("/api/posts/saved", { credentials: "include" })
      if (res.ok) setSavedPosts(await res.json())
    } catch {
      setSavedPosts([])
    } finally {
      setIsLoadingSaved(false)
    }
  }

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
      const filtered = allPosts.filter((p: any) => p.userId === user?.id)
      setUserPosts(filtered)
    } catch (err) {
      console.error("Failed to fetch user posts:", err)
      setUserPosts([])
    } finally {
      setIsLoadingPosts(false)
    }
  }

  if (isLoading || !user) return null

  const bio = user.bio || "The vision is yet to be written."
  const website = user.website || ""
  const instagram = ((user as any).instagram || "").trim()
  const userRole = user.role || "designer"
  const websiteHref = normalizeWebsiteUrl(website)
  const websiteHostname = getSafeHostname(website)

  return (
    <DashboardLayout showRail={true}>
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={refresh}
        user={user}
      />
      <VerificationModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        user={user}
      />

      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto", paddingBottom: "40px" }}>
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
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "User")}&background=0D8ABC&color=fff&size=120&rounded=true&bold=true`}
              alt={user?.fullName || "User"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "User")}&background=0D8ABC&color=fff&size=120&rounded=true&bold=true`
              }}
            />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--t-ink)", margin: "0 0 8px 0", display: "inline-flex", alignItems: "center", gap: 8 }}>
                {user?.fullName}
                {user?.isVerified && <VerifiedBadge size={20} />}
              </h1>
              <p style={{ fontSize: "14px", color: "var(--t-ink-2)", margin: "0 0 8px 0" }}>
                @{user?.username || user?.email?.split("@")[0]}
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

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => router.push(`/settings`)}
                style={{ background: "var(--t-surface-2)", border: "1px solid var(--t-line)", color: "var(--t-ink)", padding: "8px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}
              >
                <Settings size={13} />
                Settings
              </button>
              {!user?.isVerified && (
                <button
                  onClick={() => setIsVerifyModalOpen(true)}
                  style={{ background: "var(--t-gold-soft)", border: "1px solid var(--t-gold)", color: "var(--t-gold-ink)", padding: "8px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}
                >
                  <Shield size={13} />
                  Get verified
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="t-profile-stats">
          <div>
            <div className="t-stat-big">{userPosts.length}</div>
            <div className="t-stat-lbl">Works</div>
          </div>
          <div style={{ cursor: "pointer" }} onClick={() => setActiveTab("following")}>
            <div className="t-stat-big">{following.length}</div>
            <div className="t-stat-lbl">Following</div>
          </div>
        </div>

        <div className="t-profile-tabs">
          {["posts", "saved", "following"].map((tab) => (
            <button
              key={tab}
              className={`t-tab ${activeTab === tab ? "on" : ""}`}
              onClick={() => {
                setActiveTab(tab)
                if (tab === "saved" && savedPosts.length === 0 && !isLoadingSaved) fetchSavedPosts()
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "posts" && (
          <div style={{ marginTop: "20px" }}>
            {isLoadingPosts ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
              </div>
            ) : userPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "2px dashed var(--t-line)", borderRadius: "12px" }}>
                <p style={{ color: "var(--t-ink-2)", marginBottom: "16px" }}>No works published yet</p>
                <button
                  onClick={() => router.push(`/feed`)}
                  style={{ color: "var(--t-gold-ink)", background: "none", border: 0, cursor: "pointer", fontWeight: 500 }}
                >
                  Publish your first piece
                </button>
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
                    aria-label={post.description || "Open post"}
                  >
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt={post.description || "Work"} loading="lazy" />
                    ) : (
                      <span className="t-grid-text">{post.description}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "saved" && (
          <div style={{ marginTop: "20px" }}>
            {isLoadingSaved ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: "var(--t-gold)" }}></div>
              </div>
            ) : savedPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "2px dashed var(--t-line)", borderRadius: "12px" }}>
                <p style={{ color: "var(--t-ink-2)" }}>No saved posts yet</p>
              </div>
            ) : (
              <div className="t-profile-grid">
                {savedPosts.map((post) => (
                  <button
                    key={post.id}
                    className="t-grid-item"
                    onClick={() => {
                      prefetchComments(post.id)
                      setSelectedPost({ ...post, savedByMe: true })
                    }}
                    style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
                    aria-label={post.description || "Open saved post"}
                  >
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt={post.description || "Saved"} loading="lazy" />
                    ) : (
                      <span className="t-grid-text">{post.description}</span>
                    )}
                  </button>
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
        {activeTab === "following" && (
          <div style={{ marginTop: "20px" }}>
            {loadingFollowing ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
                <div className="animate-spin rounded-full h-10 w-10 border-t-2" style={{ borderColor: "var(--t-gold)" }} />
              </div>
            ) : following.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "2px dashed var(--t-line)", borderRadius: "12px" }}>
                <p style={{ color: "var(--t-ink-2)" }}>You're not following anyone yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {following.map(u => (
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
      </div>
    </DashboardLayout>
  )
}
