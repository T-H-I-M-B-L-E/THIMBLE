import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(
      'https://api.github.com/repos/T-H-I-M-B-L-E/THIMBLE/commits?per_page=8',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'THIMBLE-Admin',
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
        next: { revalidate: 60 },
      }
    )
    if (!res.ok) return NextResponse.json([], { status: 200 })
    const data = await res.json()
    const commits = data.map((c: {
      sha: string
      commit: { message: string; author: { name: string; date: string } }
      html_url: string
    }) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0].slice(0, 72),
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    }))
    return NextResponse.json(commits)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
