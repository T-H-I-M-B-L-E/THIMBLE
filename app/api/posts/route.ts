import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getApiBaseUrl() {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value
    const headers: Record<string, string> = {}

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${getApiBaseUrl()}/api/posts`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers,
    })

    const text = await response.text()

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in GET /api/posts:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const token = request.cookies.get('auth_token')?.value
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${getApiBaseUrl()}/api/posts`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    })

    const text = await response.text()

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in POST /api/posts:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 502 })
  }
}
