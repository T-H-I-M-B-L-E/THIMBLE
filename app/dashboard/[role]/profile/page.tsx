"use client"

import { useAuth } from "@/lib/useAuth"
import { DashboardLayout } from "@/components/dashboard-layout"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { EditProfileModal } from "@/components/edit-profile-modal"
import { useStore } from "@/lib/store"
import { getApiUrl, getSafeHostname, normalizeWebsiteUrl } from "@/lib/platform"
import { Globe, Instagram, Trash2, Settings, Shield, User } from "lucide-react"
import { useFollowing } from "@/hooks/use-social"

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const role = params.role as string
  const { user, isLoading } = useAuth()
  const { designPosts } = useStore()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  const [activeTab, setActiveTab] = useState("posts")
  const { following, isLoading: loadingFollowing } = useFollowing(user?.id)

  useEffect(() => {
    if (!isLoading && user) {
      fetchUserPosts()
    }
  }, [isLoading, user])

  const fetchUserPosts = async () => {
    const postsUrl = getApiUrl("/api/posts")

    if (!postsUrl) {
      const fallbackPosts = designPosts.filter((post) => post.userId === user?.id)
      setUserPosts(
        fallbackPosts.map((post) => ({
          id: post.id,
          imageUrl: post.image,
          description: post.description,
        }))
      )
      setIsLoadingPosts(false)
      return
    }

    try {
      const res = await fetch(postsUrl)
      const allPosts = await res.json()
      const filtered = allPosts.filter((p: any) => p.userId === user?.id)
      setUserPosts(filtered)
    } catch (err) {
      console.error("Failed to fetch user posts:", err)
      const fallbackPosts = designPosts.filter((post) => post.userId === user?.id)
      setUserPosts(
        fallbackPosts.map((post) => ({
          id: post.id,
          imageUrl: post.image,
          description: post.description,
        }))
      )
    } finally {
      setIsLoadingPosts(false)
    }
  }

  const handleDeletePost = async (postId: number | string) => {
    if (!confirm("Remove this piece from your portfolio?")) return

    const deleteUrl = getApiUrl(`/api/posts/${postId}`)

    if (!deleteUrl) {
      setUserPosts(userPosts.filter(p => String(p.id) !== String(postId)))
      return
    }

    try {
      const res = await fetch(deleteUrl, {
        method: "DELETE"
      })
      if (res.ok) {
        setUserPosts(userPosts.filter(p => String(p.id) !== String(postId)))
      } else {
        alert("Could not delete from server.")
      }
    } catch (err) {
      console.error("Failed to delete post:", err)
      alert("Network error. Is the backend server running?")
    }
  }

  if (isLoading || !user) return null

  const bio = user.bio || "The vision is yet to be written."
  const website = user.website || ""
  const instagram: string = "" // TODO: Add instagram to user model if needed
  const avatarUrl = user.avatar || "/placeholder-avatar.png"
  const userRole = user.role || role
  const websiteHref = normalizeWebsiteUrl(website)
  const websiteHostname = getSafeHostname(website)

  return (
    <DashboardLayout role={role} showRail={true}>
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={user}
      />

      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto", paddingBottom: "40px" }}>
        {/* Profile Cover + Header */}
        <div style={{ marginBottom: "20px" }}>
          <div className="t-profile-cover" />

          <div className="t-profile-head">
            {/* Avatar */}
            <div className="t-profile-avatar">
              <Image
                src={avatarUrl}
                alt={user?.fullName || "User"}
                width={120}
                height={120}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                priority
              />
            </div>

            {/* Meta */}
            <div className="t-profile-meta">
              <h1 className="t-profile-name">{user?.fullName}</h1>
              <p className="t-muted-xs" style={{ marginTop: "4px" }}>
                @{user?.email?.split("@")[0]}
              </p>
              <p className="t-muted-xs" style={{ marginTop: "2px", textTransform: "capitalize" }}>{userRole}</p>

              <p className="t-profile-bio">{bio}</p>

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
            </div>

            {/* Actions */}
            <div className="t-profile-actions">
              <button
                onClick={() => setIsEditModalOpen(true)}
                style={{ background: "var(--t-surface-2)", border: "1px solid var(--t-line)", color: "var(--t-ink)", padding: "8px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}
              >
                <Settings size={13} />
                Edit
              </button>
              <button
                style={{ background: "var(--t-gold-soft)", border: "1px solid var(--t-gold)", color: "var(--t-gold-ink)", padding: "8px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}
              >
                <Shield size={13} />
                Verify
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
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
                <p style={{ color: "var(--t-ink-2)", marginBottom: "16px" }}>No works published yet</p>
                <button
                  onClick={() => router.push(`/dashboard/${role}/feed`)}
                  style={{ color: "var(--t-gold-ink)", background: "none", border: 0, cursor: "pointer", fontWeight: 500 }}
                >
                  Publish your first piece
                </button>
              </div>
            ) : (
              <div className="t-profile-grid">
                {userPosts.map((post) => (
                  <div key={post.id} className="t-grid-item">
                    <img src={post.imageUrl} alt={post.description || "Work"} />
                    <div className="t-grid-overlay">
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        style={{
                          background: "rgba(255,255,255,0.1)",
                          border: "1px solid rgba(255,255,255,0.3)",
                          color: "white",
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginLeft: "auto"
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Following Tab */}
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
