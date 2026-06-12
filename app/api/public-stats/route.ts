import { NextResponse } from 'next/server'

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

// Public, unauthenticated. Cached briefly so the landing page doesn't hammer
// the DB — the counts don't need to be real-time.
export async function GET() {
  try {
    const res = await fetch(`${api()}/api/public-stats`, {
      next: { revalidate: 300 }, // 5 min
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({}, { status: 200 })
  }
}
