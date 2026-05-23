"use client"

import { useState } from "react"

interface AvatarProps {
  name: string
  image?: string
  size?: number
}

function getAvatarColor(name: string): string {
  const colors = [
    "0D8ABC", // Blue
    "FF6B6B", // Red
    "4ECDC4", // Teal
    "FFE66D", // Yellow
    "95E1D3", // Mint
    "C780FA", // Purple
    "FF85A2", // Pink
    "A8E6CF", // Light Green
    "FFD3B6", // Peach
    "FFAAA5", // Salmon
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ name, image, size = 40 }: AvatarProps) {
  const [imageError, setImageError] = useState(false)
  const shouldUseFallback = !image || imageError
  const avatarColor = getAvatarColor(name)

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${avatarColor}&color=fff&size=${size}&rounded=true&bold=true`

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: "var(--t-surface-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={shouldUseFallback ? fallbackUrl : image}
        alt={name}
        onError={() => setImageError(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  )
}
