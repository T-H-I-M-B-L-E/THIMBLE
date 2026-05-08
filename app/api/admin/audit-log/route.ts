import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/lib/adminAuth'

export async function GET(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error

  const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
  const res = await fetch(`${apiBase}/admin/audit-log`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
