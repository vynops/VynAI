import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { writeJsonAtomically } from '@/lib/json-storage'

const DATA_DIR = path.join(process.cwd(), 'data')
const KEYS_FILE = path.join(DATA_DIR, 'keys.json')

export interface StoredKey {
  id: string
  name: string
  keyFull: string      // stored locally — never exposed to client
  keyMasked: string    // shown in UI
  createdAt: string
  lastUsedAt: string | null
  status: 'active' | 'revoked'
  allowedModels: string[] | null
  rateLimitRpm: number
  rateLimitTpm: number | null
  requestsTotal: number
  tokensPrompt: number
  tokensCompletion: number
  tokensByModel: Record<string, { prompt: number; completion: number }>
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function listKeys(): StoredKey[] {
  ensure()
  if (!fs.existsSync(KEYS_FILE)) return []
  try {
    const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8')).keys ?? []
    return keys.map((key: StoredKey) => ({ ...key, lastUsedAt: key.lastUsedAt ?? null }))
  } catch { return [] }
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
    lastUsedAt: null,
    allowedModels: input.allowedModels ?? null,
    rateLimitRpm: input.rateLimitRpm ?? 60,
    rateLimitTpm: input.rateLimitTpm ?? null,
    requestsTotal: 0,
    tokensPrompt: 0,
    tokensCompletion: 0,
    tokensByModel: {},
  }
  const keys = [...listKeys(), key]
  ensure()
  writeJsonAtomically(KEYS_FILE, { keys })
  return key
}

export function revokeKey(id: string): boolean {
  const keys = listKeys()
  const idx = keys.findIndex(k => k.id === id)
  if (idx < 0) return false
  keys[idx] = { ...keys[idx], status: 'revoked' }
  writeJsonAtomically(KEYS_FILE, { keys })
  return true
}

export function updateKey(
  id: string,
  updates: Partial<Pick<StoredKey, 'name' | 'allowedModels' | 'rateLimitRpm' | 'rateLimitTpm'>>
): StoredKey | null {
  const keys = listKeys()
  const index = keys.findIndex(key => key.id === id)
  if (index < 0 || keys[index].status !== 'active') return null
  keys[index] = { ...keys[index], ...updates }
  writeJsonAtomically(KEYS_FILE, { keys })
  return keys[index]
}

export function deleteKey(id: string): boolean {
  const before = listKeys()
  const after = before.filter(k => k.id !== id)
  if (before.length === after.length) return false
  writeJsonAtomically(KEYS_FILE, { keys: after })
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
    keys[idx] = {
      ...keys[idx],
      requestsTotal: keys[idx].requestsTotal + 1,
      lastUsedAt: new Date().toISOString(),
    }
    ensure()
    writeJsonAtomically(KEYS_FILE, { keys })
  } catch { /* non-fatal */ }
}

export function markKeyUsed(id: string): void {
  try {
    const keys = listKeys()
    const index = keys.findIndex(key => key.id === id)
    if (index < 0) return
    keys[index] = { ...keys[index], lastUsedAt: new Date().toISOString() }
    writeJsonAtomically(KEYS_FILE, { keys })
  } catch { /* non-fatal */ }
}

/** Adds prompt/completion token counts for a key. Fire-and-forget — non-fatal. */
export function addTokenUsage(id: string, model: string, promptTokens: number, completionTokens: number): void {
  try {
    const keys = listKeys()
    const idx = keys.findIndex(k => k.id === id)
    if (idx < 0) return
    const byModel = keys[idx].tokensByModel ?? {}
    const m = byModel[model] ?? { prompt: 0, completion: 0 }
    keys[idx] = {
      ...keys[idx],
      tokensPrompt: (keys[idx].tokensPrompt ?? 0) + promptTokens,
      tokensCompletion: (keys[idx].tokensCompletion ?? 0) + completionTokens,
      tokensByModel: { ...byModel, [model]: { prompt: m.prompt + promptTokens, completion: m.completion + completionTokens } },
    }
    ensure()
    writeJsonAtomically(KEYS_FILE, { keys })
  } catch { /* non-fatal */ }
}
