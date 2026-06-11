import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/lib/adminAuth'

// Returns failed recipients (+ reasons) for a broadcast. ?id=N targets a
// specific one; omitting it uses the most recent broadcast.
export async function GET(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
  const id = request.nextUrl.searchParams.get('id')
  const qs = id ? `?id=${encodeURIComponent(id)}` : ''
  const res = await fetch(`${apiBase}/admin/broadcast/failures${qs}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
