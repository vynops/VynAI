import { NextRequest, NextResponse } from 'next/server'
import { loadSettings, saveSettings } from '@/lib/settings-store'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const settings = loadSettings()
  return NextResponse.json({
    ...settings,
    adminEmail: process.env.VYNAI_ADMIN_EMAIL ?? '',
    currentPort: process.env.PORT ?? '3010',
  })
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  // Strip read-only fields before saving
  const { adminEmail: _a, ...toSave } = body as { adminEmail?: string } & Record<string, unknown>
  const saved = saveSettings(toSave as never)
  return NextResponse.json(saved)
}
