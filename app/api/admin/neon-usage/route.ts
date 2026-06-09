import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.NEON_API_KEY
  const projectId = process.env.NEON_PROJECT_ID
  if (!apiKey || !projectId) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  // Neon billing usage returns monthly totals for the current period
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const to = now.toISOString()

  const res = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/billing/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: body }, { status: res.status })
  }

  const data = await res.json() as NeonUsage
  return NextResponse.json(data)
}

interface NeonUsage {
  compute_time_seconds?: number
  active_time_seconds?: number
  written_data_bytes?: number
  data_transfer_bytes?: number
  data_storage_bytes_hour?: number
}
