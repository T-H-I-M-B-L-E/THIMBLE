import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/lib/adminAuth'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error
  const { id } = await params
  const body = await request.json()
  const res = await fetch(`${api()}/admin/users/${id}/ban`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error
  const { id } = await params
  const res = await fetch(`${api()}/admin/users/${id}/ban`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
