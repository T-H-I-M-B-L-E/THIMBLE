"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { formatNotificationTime, getNotificationText, type Notification } from "@/lib/notifications"

interface NotificationItemProps {
  notification: Notification
  onRead?: (id: string) => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter()

  const handleContainerClick = () => {
    if (onRead) onRead(notification.id)
    if (notification.postId) {
      router.push(`/feed/${notification.postId}`)
    }
  }

  const handleUsernameClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRead) onRead(notification.id)
    if (notification.sender.id) {
      router.push(`/dashboard/manufacturer/profile/${notification.sender.id}`)
    }
  }

  const timeText = formatNotificationTime(notification.createdAt)
  const displayName = notification.sender.fullName || notification.sender.username || "User"

  return (
    <button
      onClick={handleContainerClick}
      className="w-full text-left transition-colors"
      style={{
        padding: "12px 14px",
        background: notification.read ? "transparent" : "rgba(255, 255, 255, 0.32)",
        borderBottom: "1px solid var(--t-line)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        if (notification.read) {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)"
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = notification.read ? "transparent" : "rgba(255, 255, 255, 0.32)"
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "var(--t-surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {notification.sender.avatar ? (
          <Image
            src={notification.sender.avatar}
            alt={displayName}
            width={40}
            height={40}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        ) : (
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--t-ink)",
            }}
          >
            {displayName[0]?.toUpperCase() ?? "U"}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {/* Clickable username */}
          <span
            onClick={handleUsernameClick}
            style={{
              fontWeight: 600,
              color: "var(--t-gold-ink)",
              fontSize: 13,
              cursor: "pointer",
              textDecoration: "none",
              transition: "opacity .15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            @{notification.sender.username || displayName.split(" ")[0]}
          </span>
        </div>

        {/* Notification text */}
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--t-ink)",
            lineHeight: 1.4,
          }}
        >
          {getNotificationText(notification).replace(
            notification.sender.fullName || notification.sender.username || "Someone",
            ""
          )}
        </p>

        {/* Time */}
        <span
          style={{
            fontSize: 11,
            color: "var(--t-ink-3)",
            marginTop: 4,
            display: "block",
          }}
        >
          {timeText}
        </span>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--t-gold)",
            flexShrink: 0,
            marginTop: 4,
          }}
        />
      )}
    </button>
  )
}
