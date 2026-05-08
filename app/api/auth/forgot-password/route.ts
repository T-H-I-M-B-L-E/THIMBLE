import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Call Go backend forgot-password endpoint
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
    const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || 'Failed to send reset code' },
        { status: response.status }
      )
    }

    return NextResponse.json({ resetEmailSent: true })
  } catch (error) {
    console.error('Error in POST /api/auth/forgot-password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
