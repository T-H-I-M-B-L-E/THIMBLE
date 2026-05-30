import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(_req: NextRequest) {
  const token = (await cookies()).get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
  const res = await fetch(`${apiBase}/admin/infra/test-alert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
