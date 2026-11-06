import fs from 'fs'
import path from 'path'
import { writeJsonAtomically } from '@/lib/json-storage'

const DATA_DIR = path.join(process.cwd(), 'data')

const BACKUP_SPECS = {
  servers: { file: 'servers.json', envelope: 'servers', fallback: [] },
  keys: { file: 'keys.json', envelope: 'keys', fallback: [] },
  users: { file: 'users.json', envelope: 'users', fallback: [] },
  settings: { file: 'settings.json', envelope: null, fallback: {} },
  requestLogs: { file: 'request-logs.json', envelope: 'logs', fallback: [] },
  automationJobs: { file: 'automation-jobs.json', envelope: 'jobs', fallback: [] },
  alertState: { file: 'alert-state.json', envelope: null, fallback: { offline: [], thresholds: [], rateLimitAt: {} } },
  notificationOutbox: { file: 'notification-outbox.json', envelope: 'deliveries', fallback: [] },
} as const

export interface DataBackup {
  format: 'vynai-data-backup'
  version: 1
  createdAt: string
  files: Record<keyof typeof BACKUP_SPECS, Record<string, unknown> | unknown[]>
}

function readDataFile(spec: typeof BACKUP_SPECS[keyof typeof BACKUP_SPECS]): Record<string, unknown> | unknown[] {
  const filePath = path.join(DATA_DIR, spec.file)
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!spec.envelope) return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : spec.fallback
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { [spec.envelope]: spec.fallback }
    const value = (parsed as Record<string, unknown>)[spec.envelope]
    return { [spec.envelope]: Array.isArray(value) ? value : spec.fallback }
  } catch {
    return spec.envelope ? { [spec.envelope]: spec.fallback } : spec.fallback
  }
}

export function createDataBackup(): DataBackup {
  return {
    format: 'vynai-data-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    files: {
      servers: readDataFile(BACKUP_SPECS.servers) as Record<string, unknown>,
      keys: readDataFile(BACKUP_SPECS.keys) as Record<string, unknown>,
      users: readDataFile(BACKUP_SPECS.users) as Record<string, unknown>,
      settings: readDataFile(BACKUP_SPECS.settings) as Record<string, unknown>,
      requestLogs: readDataFile(BACKUP_SPECS.requestLogs) as Record<string, unknown>,
      automationJobs: readDataFile(BACKUP_SPECS.automationJobs) as Record<string, unknown>,
      alertState: readDataFile(BACKUP_SPECS.alertState) as Record<string, unknown>,
      notificationOutbox: readDataFile(BACKUP_SPECS.notificationOutbox) as Record<string, unknown>,
    },
  }
}

export function validateDataBackup(value: unknown): value is DataBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const backup = value as Partial<DataBackup>
  if (backup.format !== 'vynai-data-backup' || backup.version !== 1 || !backup.files || typeof backup.files !== 'object') return false

  for (const [key, spec] of Object.entries(BACKUP_SPECS)) {
    const data = backup.files[key as keyof typeof BACKUP_SPECS]
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false
    if (spec.envelope) {
      const entries = (data as Record<string, unknown>)[spec.envelope]
      if (!Array.isArray(entries)) return false
    } else if (Array.isArray(data)) {
      return false
    }
  }
  const users = (backup.files.users as Record<string, unknown>).users
  if (!Array.isArray(users) || !users.some(user =>
    user && typeof user === 'object' &&
    (user as Record<string, unknown>).role === 'admin' &&
    (user as Record<string, unknown>).active === true
  )) return false
  return true
}

export function restoreDataBackup(value: unknown): string[] {
  if (!validateDataBackup(value)) throw new Error('Invalid VynAI backup file')
  fs.mkdirSync(DATA_DIR, { recursive: true })

  const current = createDataBackup()
  const restored: Array<keyof typeof BACKUP_SPECS> = []
  try {
    for (const key of Object.keys(BACKUP_SPECS) as Array<keyof typeof BACKUP_SPECS>) {
      writeJsonAtomically(path.join(DATA_DIR, BACKUP_SPECS[key].file), value.files[key])
      restored.push(key)
    }
  } catch (error) {
    for (const key of restored.reverse()) {
      try { writeJsonAtomically(path.join(DATA_DIR, BACKUP_SPECS[key].file), current.files[key]) } catch { /* Keep the pre-restore `.bak` available. */ }
    }
    throw error
  }
  return restored.map(key => BACKUP_SPECS[key].file)
}