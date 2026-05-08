import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

export async function GET(request: NextRequest) {
  try {
    const payload = await getUserFromToken()

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user data from Go backend
    const apiBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
    const userUrl = `${apiBaseUrl}/users/${payload.userId}`
    const response = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${request.cookies.get('auth_token')?.value}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`Failed to fetch user from ${userUrl}: ${response.status} ${text}`)
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: response.status })
    }

    const user = await response.json()
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error in GET /api/auth/me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
