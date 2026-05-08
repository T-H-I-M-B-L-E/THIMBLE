import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Create response and clear the cookie
    const res = NextResponse.json({ success: true })
    res.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.tvimble.tech' : undefined,
    })

    return res
  } catch (error) {
    console.error('Error in POST /api/auth/logout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
