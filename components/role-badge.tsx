"use client"

interface RoleBadgeProps {
  role: string
  size?: "sm" | "md" | "lg"
}

const roleConfig: Record<string, { bg: string; text: string }> = {
  designer: {
    bg: "#667eea",
    text: "white",
  },
  model: {
    bg: "#f5576c",
    text: "white",
  },
  photographer: {
    bg: "#4facfe",
    text: "white",
  },
  brand: {
    bg: "#43e97b",
    text: "white",
  },
  admin: {
    bg: "#fa709a",
    text: "white",
  },
}

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const config = roleConfig[role.toLowerCase()] || {
    bg: "#667eea",
    text: "white",
  }

  const sizeConfig = {
    sm: { padding: "4px 10px", fontSize: "11px" },
    md: { padding: "6px 12px", fontSize: "12px" },
    lg: { padding: "8px 16px", fontSize: "13px" },
  }

  const sizes = sizeConfig[size]

  return (
    <span
      style={{
        display: "inline-block",
        padding: sizes.padding,
        background: config.bg,
        color: config.text,
        borderRadius: "12px",
        fontSize: sizes.fontSize,
        fontWeight: 600,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {role}
    </span>
  )
}
