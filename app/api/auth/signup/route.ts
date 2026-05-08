import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      )
    }

    // Call Go backend signup endpoint
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
    const response = await fetch(`${apiBaseUrl}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, fullName }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || 'Signup failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    // Go backend returns { verificationRequired: true }
    return NextResponse.json({ verificationRequired: true, email })
  } catch (error) {
    console.error('Error in POST /api/auth/signup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
