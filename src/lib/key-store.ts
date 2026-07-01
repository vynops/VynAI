import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const KEYS_FILE = path.join(DATA_DIR, 'keys.json')

export interface StoredKey {
  id: string
  name: string
  keyFull: string      // stored locally — never exposed to client
  keyMasked: string    // shown in UI
  createdAt: string
  status: 'active' | 'revoked'
  allowedModels: string[] | null
  rateLimitRpm: number
  rateLimitTpm: number | null
  requestsTotal: number
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function listKeys(): StoredKey[] {
  ensure()
  if (!fs.existsSync(KEYS_FILE)) return []
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8')).keys ?? [] } catch { return [] }
}

export function createKey(input: { name: string; rateLimitRpm?: number; rateLimitTpm?: number | null; allowedModels?: string[] | null }): StoredKey {
  const raw = randomBytes(16).toString('hex')        // 32 hex chars
  const keyFull = `sk-vynai-${raw}`
  const keyMasked = `sk-vynai-${raw.slice(0, 6)}...${raw.slice(-4)}`
  const key: StoredKey = {
    id: randomBytes(8).toString('hex'),
    name: input.name.trim(),
    keyFull,
    keyMasked,
    createdAt: new Date().toISOString(),
    status: 'active',
    allowedModels: input.allowedModels ?? null,
    rateLimitRpm: input.rateLimitRpm ?? 60,
    rateLimitTpm: input.rateLimitTpm ?? null,
    requestsTotal: 0,
  }
  const keys = [...listKeys(), key]
  ensure()
  fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys }, null, 2))
  return key
}

export function revokeKey(id: string): boolean {
  const keys = listKeys()
  const idx = keys.findIndex(k => k.id === id)
  if (idx < 0) return false
  keys[idx] = { ...keys[idx], status: 'revoked' }
  fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys }, null, 2))
  return true
}

export function deleteKey(id: string): boolean {
  const before = listKeys()
  const after = before.filter(k => k.id !== id)
  if (before.length === after.length) return false
  fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys: after }, null, 2))
  return true
}

/** Looks up a key by its full value. Returns the key if active, null otherwise. */
export function validateKey(keyFull: string): StoredKey | null {
  const key = listKeys().find(k => k.keyFull === keyFull)
  if (!key || key.status !== 'active') return null
  return key
}

/** Increments requestsTotal for a key. Fire-and-forget — non-fatal. */
export function incrementUsage(id: string): void {
  try {
    const keys = listKeys()
    const idx = keys.findIndex(k => k.id === id)
    if (idx < 0) return
    keys[idx] = { ...keys[idx], requestsTotal: keys[idx].requestsTotal + 1 }
    ensure()
    fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys }, null, 2))
  } catch { /* non-fatal */ }
}
