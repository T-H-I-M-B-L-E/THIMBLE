import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Groq from 'groq-sdk'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt } = await request.json() as { prompt: string; mode: string }
  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })

  const client = new Groq({ apiKey })
  const response = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const result = response.choices[0]?.message?.content ?? ''
  return NextResponse.json({ result })
}
