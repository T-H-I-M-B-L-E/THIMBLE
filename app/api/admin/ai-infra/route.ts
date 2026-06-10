import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt } = await request.json() as { prompt: string; mode: string }
  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })

  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const result = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ result })
}
