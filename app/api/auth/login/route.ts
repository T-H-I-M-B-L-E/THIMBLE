import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Call Go backend login endpoint
    const apiBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || 'Login failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const { token, user } = data

    // Create response with httpOnly cookie
    const res = NextResponse.json({ success: true, user })
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.tvimble.tech' : undefined,
    })

    return res
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
