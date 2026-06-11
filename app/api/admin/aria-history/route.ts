import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/lib/adminAuth'

const apiBase = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

// Load the admin's persisted ARIA chat history.
export async function GET(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error
  const res = await fetch(`${apiBase()}/admin/aria/history`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

// Append one message to history.
export async function POST(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error
  const body = await request.text()
  const res = await fetch(`${apiBase()}/admin/aria/history`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body,
  })
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status })
}

// Clear the admin's ARIA history.
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminToken(request)
  if (auth.error) return auth.error
  const res = await fetch(`${apiBase()}/admin/aria/history`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status })
}
