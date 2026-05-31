import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
async function token() { return (await cookies()).get('admin_token')?.value }

export async function POST(req: NextRequest) {
  const t = await token()
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.text()
  const res = await fetch(`${api()}/admin/broadcast`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
