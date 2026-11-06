import { NextRequest, NextResponse } from 'next/server'
import { revokeKey, deleteKey, listKeys, updateKey } from '@/lib/key-store'
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  const key = listKeys().find(k => k.id === id)
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ keyFull: key.keyFull })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  const ok = revokeKey(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  let body: { name?: string; rateLimitRpm?: number; rateLimitTpm?: number | null; allowedModels?: string[] | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
  }
  if (body.rateLimitRpm !== undefined && (!Number.isInteger(body.rateLimitRpm) || body.rateLimitRpm < 0)) {
    return NextResponse.json({ error: 'rateLimitRpm must be a non-negative integer' }, { status: 400 })
  }
  if (body.rateLimitTpm !== undefined && body.rateLimitTpm !== null && (!Number.isInteger(body.rateLimitTpm) || body.rateLimitTpm < 1)) {
    return NextResponse.json({ error: 'rateLimitTpm must be a positive integer or null' }, { status: 400 })
  }
  if (body.allowedModels !== undefined && body.allowedModels !== null &&
    (!Array.isArray(body.allowedModels) || body.allowedModels.some(model => typeof model !== 'string' || !model.trim()))) {
    return NextResponse.json({ error: 'allowedModels must be an array of non-empty model names or null' }, { status: 400 })
  }
  const updates = {
    ...(body.name !== undefined && { name: body.name.trim() }),
    ...(body.rateLimitRpm !== undefined && { rateLimitRpm: body.rateLimitRpm }),
    ...(body.rateLimitTpm !== undefined && { rateLimitTpm: body.rateLimitTpm }),
    ...(body.allowedModels !== undefined && { allowedModels: body.allowedModels ? [...new Set(body.allowedModels.map(model => model.trim()))] : null }),
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'At least one field is required' }, { status: 400 })
  const key = updateKey(id, updates)
  if (!key) return NextResponse.json({ error: 'Active key not found' }, { status: 404 })
  const { keyFull: _secret, ...safeKey } = key
  return NextResponse.json(safeKey)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  const ok = deleteKey(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
