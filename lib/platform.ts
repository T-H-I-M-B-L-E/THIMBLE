"use client"

type AuthLikeUser = {
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

  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) return null

  return apiBaseUrl.replace(/^http/, "ws")
}

export const getDashboardFeedPath = (role?: string | null) => {
  if (!role) return "/onboarding"
  return `/dashboard/${role}/feed`
}

export const getPostAuthPath = (user?: AuthLikeUser | null) => {
  const metadata = user?.unsafeMetadata ?? {}
  const isOnboarded = metadata.onboardingCompleted === true
  const role = typeof metadata.role === "string" ? metadata.role : null

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
