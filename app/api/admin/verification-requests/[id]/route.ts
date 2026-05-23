import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/lib/adminAuth'

const apiBase = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  const { id } = await params
  const body = await request.text()

  const res = await fetch(`${apiBase()}/admin/verification-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body,
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
