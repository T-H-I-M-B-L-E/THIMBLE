export type NotificationType = "LIKE" | "TAG" | "FOLLOW"

export interface NotificationSender {
  id: string
  fullName: string
  avatar?: string
  username?: string
}

export interface Notification {
  id: string
  type: NotificationType
  sender: NotificationSender
  postId?: string
  userId?: string
  createdAt: string
  read: boolean
}

export function formatNotificationTime(createdAt: string): string {
  try {
    const date = new Date(createdAt)
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return "now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

export function getNotificationText(notification: Notification): string {
  const name = notification.sender.fullName || notification.sender.username || "Someone"
  switch (notification.type) {
    case "LIKE":
      return `${name} liked your post`
    case "TAG":
      return `${name} tagged you in a post`
    case "FOLLOW":
      return `${name} followed you`
    default:
      return "New notification"
  }
}
