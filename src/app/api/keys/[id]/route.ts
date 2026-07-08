import { NextRequest, NextResponse } from 'next/server'
import { revokeKey, deleteKey, listKeys } from '@/lib/key-store'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const key = listKeys().find(k => k.id === id)
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ keyFull: key.keyFull })
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = revokeKey(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = deleteKey(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
