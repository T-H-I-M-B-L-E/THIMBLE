import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/lib/adminAuth'

const apiBase = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  const res = await fetch(`${apiBase()}/admin/settings`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const res = await fetch(`${apiBase()}/admin/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
