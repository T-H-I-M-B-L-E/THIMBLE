"use client"

type AuthLikeUser = {
  // JWT user shape
  role?: string | null
  // Legacy Clerk shape (kept for compatibility during migration)
  unsafeMetadata?: Record<string, unknown>
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

export const getApiBaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  return value ? trimTrailingSlash(value) : null
}

export const getApiUrl = (path: string) => {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) return null
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

export const getWebSocketUrl = () => {
  const explicitUrl = process.env.NEXT_PUBLIC_WS_URL?.trim()
  if (explicitUrl) return trimTrailingSlash(explicitUrl)

  const apiBaseUrl = getApiBaseUrl() || 'https://thimble-production.up.railway.app'
  if (!apiBaseUrl) return null

  return apiBaseUrl.replace(/^http/, "ws")
}

export const getDashboardFeedPath = (role?: string | null) => {
  if (!role) return "/onboarding"
  return `/dashboard/${role}/feed`
}

export const getPostAuthPath = (user?: AuthLikeUser | null) => {
  if (!user) return "/auth"

  // JWT user: role lives at the top level
  const jwtRole = typeof user.role === "string" ? user.role : null

  // Legacy Clerk user: role lives inside unsafeMetadata
  const metadata = user?.unsafeMetadata ?? {}
  const clerkRole = typeof metadata.role === "string" ? metadata.role : null
  const clerkOnboarded = metadata.onboardingCompleted === true

  const role = jwtRole || clerkRole

  // For JWT users, having a role means onboarding is complete.
  // For Clerk users, we check the explicit onboardingCompleted flag.
  const isOnboarded = !!jwtRole || clerkOnboarded

  if (isOnboarded && role) {
    return getDashboardFeedPath(role)
  }

  return "/onboarding"
}

export const normalizeWebsiteUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export const getSafeHostname = (value: string) => {
  if (!value) return ""

  try {
    return new URL(normalizeWebsiteUrl(value)).hostname
  } catch {
    return ""
  }
}
