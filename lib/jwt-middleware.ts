import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

interface JWTPayload {
  userId: string
  email: string
  role?: string
  iat: number
  exp: number
}

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set')
  }
  return new TextEncoder().encode(secret)
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, getJWTSecret())
    return verified.payload as unknown as JWTPayload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

export async function getTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('admin_token')?.value
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
