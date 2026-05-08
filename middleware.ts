import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

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
  } catch {
    return null
  }
}

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

function loginRedirect(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.search = ''
  const res = NextResponse.redirect(url)
  // Clear any stale admin_token (must match the domain it was set with)
  res.cookies.set('admin_token', '', { maxAge: 0, path: '/', domain: '.tvimble.tech' })
  return addSecurityHeaders(res)
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const hostname = req.headers.get('host') || ''

  // ── Admin routing ────────────────────────────────────────────────────────
  const isAdminSubdomain = hostname.startsWith('admin.') || hostname === 'admin.localhost'
  const isAdminPath = pathname.startsWith('/admin')

  if (isAdminSubdomain || isAdminPath) {
    const isLoginPage = pathname === '/login' || pathname === '/admin/login'
    const isSplashPage = pathname === '/admin/splash'

    // Rewrite bare /login → /admin/login on subdomain
    if (isAdminSubdomain && pathname === '/login') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.rewrite(url)
    }

    // Login and splash pass through without a token
    if (isLoginPage || isSplashPage) {
      return addSecurityHeaders(NextResponse.next())
    }

    // API routes pass through — the Go backend validates the JWT
    if (pathname.startsWith('/api/admin/')) {
      return NextResponse.next()
    }

    // All other admin pages require the cookie to exist
    // The Go backend is the JWT authority — we don't re-verify here to avoid secret mismatches
    const token = req.cookies.get('admin_token')?.value
    if (!token) return loginRedirect(req)

    // On subdomain: rewrite to /admin prefix if not already there
    if (isAdminSubdomain && !pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
      const url = req.nextUrl.clone()
      url.pathname = `/admin${pathname === '/' ? '' : pathname}`
      return addSecurityHeaders(NextResponse.rewrite(url))
    }

    return addSecurityHeaders(NextResponse.next())
  }

  // ── Regular app routes ───────────────────────────────────────────────────
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next()
  }

  const token = req.cookies.get('auth_token')?.value
  if (!token) return NextResponse.redirect(new URL('/auth', req.url))

  const payload = await verifyJWT(token)
  if (!payload) return NextResponse.redirect(new URL('/auth', req.url))

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
