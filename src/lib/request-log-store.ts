import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

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
  try {
    const all: RequestLog[] = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8')).logs ?? []
    return all.slice(-limit).reverse()
  } catch { return [] }
}

export function appendLog(log: Omit<RequestLog, 'id'>): void {
  try {
    ensure()
    const existing: RequestLog[] = fs.existsSync(LOGS_FILE)
      ? (JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8')).logs ?? [])
      : []
    const trimmed = existing.length >= MAX_LOGS ? existing.slice(-MAX_LOGS + 1) : existing
    trimmed.push({ id: randomBytes(6).toString('hex'), ...log })
    fs.writeFileSync(LOGS_FILE, JSON.stringify({ logs: trimmed }, null, 2))
  } catch { /* non-fatal */ }
}
