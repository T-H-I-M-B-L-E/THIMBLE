"use client"

import { useState, useRef, useEffect } from "react"
import { Bell } from "lucide-react"
import { useNotifications } from "@/hooks/use-notifications"
import { NotificationItem } from "./notification-item"

interface NotificationCenterProps {
  userId: string | undefined
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { notifications, isLoading, markAsRead, unreadCount } = useNotifications(userId)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div
      ref={dropdownRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--t-ink-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          position: "relative",
          transition: "color .15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--t-ink)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--t-ink-2)")}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--t-gold)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 8,
            width: 360,
            maxHeight: 480,
            borderRadius: 14,
            background: "var(--t-surface)",
            border: "1px solid var(--t-line)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--t-line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--t-ink)",
                margin: 0,
              }}
            >
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--t-ink-3)",
                  fontWeight: 500,
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          {/* List */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            {isLoading ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--t-ink-3)",
                  fontSize: 13,
                }}
              >
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--t-ink-3)",
                  fontSize: 13,
                }}
              >
                No notifications yet
              </div>
            ) : (
              notifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onRead={markAsRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
