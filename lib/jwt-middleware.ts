import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

interface JWTPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

// Read secret lazily so tests can set process.env.JWT_SECRET before calling verifyJWT
function getJWTSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
  )
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, getJWTSecret())
    return verified.payload as JWTPayload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

export async function getTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value
    return token || null
  } catch (error) {
    console.error('Failed to get token from cookie:', error)
    return null
  }
}

export async function getUserFromToken(): Promise<JWTPayload | null> {
  const token = await getTokenFromCookie()
  if (!token) return null
  return verifyJWT(token)
}
