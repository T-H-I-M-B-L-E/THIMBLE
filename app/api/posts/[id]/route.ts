import { NextRequest, NextResponse } from 'next/server'

function getApiBaseUrl() {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const token = request.cookies.get('auth_token')?.value
    const headers: Record<string, string> = {}

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${getApiBaseUrl()}/api/posts/${id}`, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(5000),
    })

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const text = await response.text()

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (error) {
    console.error(`Error in DELETE /api/posts/[id]:`, error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 502 })
  }
}
