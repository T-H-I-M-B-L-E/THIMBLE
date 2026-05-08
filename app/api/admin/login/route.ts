import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const apiBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error || 'Invalid credentials' }, { status: 401 })
    }

    const data = await res.json()

    // Verify the user is an admin (isAdmin is top-level in the response, not inside user)
    if (!data.isAdmin) {
      return NextResponse.json({ error: 'Access denied — not an admin' }, { status: 403 })
    }

    const response = NextResponse.json({ success: true, fullName: data.fullName || data.user?.fullName || '' })
    response.cookies.set('admin_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.tvimble.tech' : undefined,
    })
    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
