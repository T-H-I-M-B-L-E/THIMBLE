import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/jwt-middleware'

const api = () =>
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

const getToken = (req: NextRequest) => req.cookies.get('auth_token')?.value ?? ''

/**
 * POST /api/posts/[id]/share
 *
 * Body (JSON):
 *   platform?: string   — 'twitter' | 'linkedin' | 'whatsapp' | 'email' | 'copy' | 'internal'
 *   toUserId?: string   — required when platform === 'internal'
 *   note?: string       — optional message when sharing internally
 *
 * Returns: { ok: true, shareCount?: number }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getUserFromToken()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const token = getToken(request)
    const body = await request.json().catch(() => ({}))

    // Forward share event to the backend (analytics + internal notification)
    const res = await fetch(`${api()}/api/posts/${id}/share`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: body.platform ?? 'unknown',
        toUserId: body.toUserId ?? null,
        note: body.note ?? null,
      }),
      signal: AbortSignal.timeout(5000),
    })

    // If the backend doesn't have this endpoint yet, return a graceful ok
    if (res.status === 404 || res.status === 405) {
      return NextResponse.json({ ok: true })
    }

    const data = await res.json().catch(() => ({ ok: true }))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (err) {
    console.error('POST /api/posts/[id]/share error:', err)
    // Non-fatal — share UI shouldn't break if analytics fail
    return NextResponse.json({ ok: true })
  }
}
