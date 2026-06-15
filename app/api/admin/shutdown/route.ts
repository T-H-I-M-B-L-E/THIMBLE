import { NextRequest, NextResponse } from "next/server"
import { requireAdminToken } from "@/lib/adminAuth"

const api = () => process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080"

async function proxy(req: NextRequest, path: string, method = "POST") {
  const auth = await requireAdminToken(req)
  if (auth.error) return auth.error

  const body = method !== "GET" ? await req.text() : undefined
  const res = await fetch(`${api()}/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

// GET /api/admin/shutdown?action=pin-status
export async function GET(req: NextRequest) {
  const auth = await requireAdminToken(req)
  if (auth.error) return auth.error
  const res = await fetch(`${api()}/admin/shutdown/pin-status`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

// POST /api/admin/shutdown?action=set-pin|verify-pin|request-otp|verify-otp|execute
export async function POST(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action")
  if (action === "set-pin")     return proxy(req, "/shutdown/set-pin")
  if (action === "verify-pin")  return proxy(req, "/shutdown/verify-pin")
  if (action === "request-otp") return proxy(req, "/shutdown/request-otp")
  if (action === "verify-otp")  return proxy(req, "/shutdown/verify-otp")
  if (action === "execute")     return proxy(req, "/shutdown/execute")
  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
