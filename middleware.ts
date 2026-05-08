import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// Read lazily so process.env.JWT_SECRET is picked up at call time (also helps tests)
function getJWTSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
  )
}

const protectedRoutes = [
  '/dashboard',
  '/onboarding',
  '/upload',
  '/explore',
  '/feed',
  '/profile',
]

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route))
}

async function verifyJWT(token: string) {
  try {
    const verified = await jwtVerify(token, getJWTSecret())
    return verified.payload
  } catch (error) {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Skip middleware for non-protected routes
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next()
  }

  // Get JWT from cookies
  const token = req.cookies.get('auth_token')?.value

  if (!token) {
    // No token, redirect to auth
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  // Verify JWT
  const payload = await verifyJWT(token)

  if (!payload) {
    // Invalid token, redirect to auth
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  // Token is valid, continue
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
