import { NextRequest, NextResponse } from 'next/server'
import { listKeys, createKey } from '@/lib/key-store'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  // Never expose keyFull to client
  return NextResponse.json(listKeys().map(({ keyFull: _k, ...rest }) => rest))
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  let body: { name?: string; rateLimitRpm?: number; rateLimitTpm?: number | null; allowedModels?: string[] | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const key = createKey({ ...body, name: body.name })
  const { keyFull, ...safe } = key
  // Return the full key once on creation (user must copy it now)
  return NextResponse.json({ ...safe, keyFull }, { status: 201 })
}
