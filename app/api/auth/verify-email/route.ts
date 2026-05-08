import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, code, password, fullName } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      )
    }

    // Call Go backend verify-email endpoint
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
    const response = await fetch(`${apiBaseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code, password, fullName }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || 'Verification failed' },
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
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return res
  } catch (error) {
    console.error('Error in POST /api/auth/verify-email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
