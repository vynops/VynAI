import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { loadSettings } from '@/lib/settings-store'
import { writeJsonAtomically } from '@/lib/json-storage'

const DATA_DIR = path.join(process.cwd(), 'data')
const LOGS_FILE = path.join(DATA_DIR, 'request-logs.json')
const MAX_LOGS = 10_000

export interface RequestLog {
  id: string
  timestamp: string
  keyId: string
  keyName: string
  model: string
  promptTokens: number
  completionTokens: number
  latencyMs: number
  status: number
  error?: string
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function listLogs(limit = 500): RequestLog[] {
  ensure()
  if (!fs.existsSync(LOGS_FILE)) return []
  const all = readLogs()
  const retained = applyRetention(all)
  if (retained.length !== all.length) writeLogs(retained)
  return retained.slice(-limit).reverse()
}

function readLogs(): RequestLog[] {
  try { return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8')).logs ?? [] } catch { return [] }
}

function writeLogs(logs: RequestLog[]): void {
  writeJsonAtomically(LOGS_FILE, { logs })
}

function applyRetention(logs: RequestLog[]): RequestLog[] {
  const retentionDays = loadSettings().logRetentionDays
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return logs
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  return logs.filter(log => {
    const timestamp = Date.parse(log.timestamp)
    return !Number.isFinite(timestamp) || timestamp >= cutoff
  })
}

export function appendLog(log: Omit<RequestLog, 'id'>): void {
  try {
    ensure()
    const existing = applyRetention(fs.existsSync(LOGS_FILE) ? readLogs() : [])
    const trimmed = existing.length >= MAX_LOGS ? existing.slice(-MAX_LOGS + 1) : existing
    trimmed.push({ id: randomBytes(6).toString('hex'), ...log })
    writeLogs(trimmed)
  } catch { /* non-fatal */ }
}
