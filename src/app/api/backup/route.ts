import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createDataBackup, restoreDataBackup } from '@/lib/backup-store'

const MAX_BACKUP_BYTES = 50 * 1024 * 1024

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const backup = createDataBackup()
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="vynai-backup-${backup.createdAt.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > MAX_BACKUP_BYTES) return NextResponse.json({ error: 'Backup file exceeds 50 MB' }, { status: 413 })

  let backup: unknown
  try { backup = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON backup' }, { status: 400 }) }
  try {
    const restoredFiles = restoreDataBackup(backup)
    return NextResponse.json({ ok: true, restoredFiles })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Backup restore failed' }, { status: 400 })
  }
}