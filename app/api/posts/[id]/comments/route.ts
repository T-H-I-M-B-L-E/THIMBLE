import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getApiBaseUrl() {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const response = await fetch(`${getApiBaseUrl()}/api/posts/${id}/comments`, {
      cache: 'no-store',
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
    console.error('Error in GET /api/posts/[id]/comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 502 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.text()
    const response = await fetch(`${getApiBaseUrl()}/api/posts/${id}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    console.error('Error in POST /api/posts/[id]/comments:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 502 })
  }
}
