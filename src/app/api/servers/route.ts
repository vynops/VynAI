import { NextRequest, NextResponse } from 'next/server'
import { listServers, addServer } from '@/lib/server-store'

export async function GET() {
  // Never expose sshPassword to client
  return NextResponse.json(listServers().map(({ sshPassword: _p, ...s }) => s))
}

export async function POST(req: NextRequest) {
  let body: { name?: string; url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, url } = body
  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'name and url are required' }, { status: 400 })
  }

  // Basic URL validation
  try { new URL(url) } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  const server = addServer({ name, url })
  return NextResponse.json(server, { status: 201 })
}
