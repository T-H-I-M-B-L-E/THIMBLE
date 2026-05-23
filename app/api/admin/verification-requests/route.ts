import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/lib/adminAuth'

const apiBase = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()

  const res = await fetch(`${apiBase()}/admin/verification-requests${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: 'no-store',
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
