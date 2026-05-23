"use client"

interface VerifiedBadgeProps {
  size?: number
  title?: string
}

/**
 * Gold verification badge — Instagram-style scalloped shape.
 * Use inline next to a username.
 */
export function VerifiedBadge({ size = 14, title = "Verified" }: VerifiedBadgeProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-label={title}
      role="img"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="t-verified-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F7E08A" />
          <stop offset="50%" stopColor="#D4A93A" />
          <stop offset="100%" stopColor="#B07F1A" />
        </linearGradient>
      </defs>
      {/* Scalloped seal */}
      <path
        d="M12 1.2l2.35 2.05 3.05-.55 1.05 2.95 2.85 1.4-.55 3.05L23 12l-2.25 1.9.55 3.05-2.85 1.4-1.05 2.95-3.05-.55L12 22.8l-2.35-2.05-3.05.55-1.05-2.95-2.85-1.4.55-3.05L1 12l2.25-1.9-.55-3.05 2.85-1.4 1.05-2.95 3.05.55L12 1.2z"
        fill="url(#t-verified-gold)"
      />
      {/* White checkmark */}
      <path
        d="M9.5 12.5l1.8 1.8 3.7-4.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
