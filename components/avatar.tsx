"use client"

import { useState } from "react"
import Image from "next/image"

interface AvatarProps {
  name: string
  image?: string
  size?: number
}

function getAvatarColor(name: string): string {
  const colors = [
    "0D8ABC", "FF6B6B", "4ECDC4", "FFE66D", "95E1D3",
    "C780FA", "FF85A2", "A8E6CF", "FFD3B6", "FFAAA5",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function InitialsFallback({ name, size }: { name: string; size: number }) {
  const color = getAvatarColor(name)
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={name}
    >
      <circle cx={size / 2} cy={size / 2} r={size / 2} fill={`#${color}`} />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="#fff"
        fontFamily="sans-serif"
        fontWeight="700"
        fontSize={size * 0.38}
      >
        {initials}
      </text>
    </svg>
  )
}

export function Avatar({ name, image, size = 40 }: AvatarProps) {
  const [imageError, setImageError] = useState(false)
  const showImage = !!image && !imageError

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
        position: "relative",
      }}
    >
      {showImage ? (
        <Image
          src={image}
          alt={name}
          fill
          sizes={`${size}px`}
          style={{ objectFit: "cover" }}
          onError={() => setImageError(true)}
        />
      ) : (
        <InitialsFallback name={name} size={size} />
      )}
    </div>
  )
}
