/**
 * Sliding-window rate limiter (per API key, in-memory).
 * Tracks request timestamps within the last 60 seconds.
 */

// keyId → array of request timestamps (ms)
const windows = new Map<string, number[]>()
const loginWindows = new Map<string, number[]>()
const keyTokenWindows = new Map<string, Array<{ ts: number; tokens: number }>>()
const globalWindow: number[] = []
const tokenWindow: Array<{ ts: number; tokens: number }> = []
const loginGlobalWindow: number[] = []

export function checkLoginRateLimit(email: string): boolean {
  const now = Date.now()
  const cutoff = now - 60_000
  while (loginGlobalWindow.length && loginGlobalWindow[0] <= cutoff) loginGlobalWindow.shift()
  if (loginGlobalWindow.length >= 120) return false

  const key = email.trim().toLowerCase() || '<empty>'
  const attempts = (loginWindows.get(key) ?? []).filter(timestamp => timestamp > cutoff)
  if (attempts.length >= 10) {
    loginWindows.set(key, attempts)
    return false
  }
  attempts.push(now)
  loginWindows.set(key, attempts)
  loginGlobalWindow.push(now)

  if (loginWindows.size > 10_000) {
    const oldestKey = loginWindows.keys().next().value
    if (oldestKey) loginWindows.delete(oldestKey)
  }
  return true
}

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 * Automatically prunes stale timestamps.
 */
export function checkRateLimit(keyId: string, limitRpm: number): boolean {
  if (limitRpm <= 0) return true

  const now = Date.now()
  const cutoff = now - 60_000

  const timestamps = (windows.get(keyId) ?? []).filter(t => t > cutoff)
  if (timestamps.length >= limitRpm) {
    windows.set(keyId, timestamps)
    return false
  }
  timestamps.push(now)
  windows.set(keyId, timestamps)
  return true
}

export function checkKeyTokenLimit(keyId: string, limitTpm: number | null): boolean {
  if (!limitTpm || limitTpm <= 0) return true
  const cutoff = Date.now() - 60_000
  const usage = (keyTokenWindows.get(keyId) ?? []).filter(entry => entry.ts > cutoff)
  keyTokenWindows.set(keyId, usage)
  return usage.reduce((sum, entry) => sum + entry.tokens, 0) < limitTpm
}

/**
 * Global requests-per-minute limiter across all API keys.
 * 0 or lower disables global RPM enforcement.
 */
export function checkGlobalRateLimit(limitRpm: number): boolean {
  if (limitRpm <= 0) return true

  const now = Date.now()
  const cutoff = now - 60_000

  while (globalWindow.length && globalWindow[0] <= cutoff) {
    globalWindow.shift()
  }

  if (globalWindow.length >= limitRpm) return false
  globalWindow.push(now)
  return true
}

/**
 * Global tokens-per-minute limiter across all API keys.
 * null or 0 disables global TPM enforcement.
 */
export function checkGlobalTokenLimit(limitTpm: number | null): boolean {
  if (!limitTpm || limitTpm <= 0) return true

  const now = Date.now()
  const cutoff = now - 60_000

  while (tokenWindow.length && tokenWindow[0].ts <= cutoff) {
    tokenWindow.shift()
  }

  const used = tokenWindow.reduce((sum, entry) => sum + entry.tokens, 0)
  return used < limitTpm
}

/** Records consumed tokens for global TPM accounting. */
export function addGlobalTokenUsage(tokens: number): void {
  if (tokens <= 0) return
  tokenWindow.push({ ts: Date.now(), tokens })
}

export function addKeyTokenUsage(keyId: string, tokens: number): void {
  if (tokens <= 0) return
  const cutoff = Date.now() - 60_000
  const usage = (keyTokenWindows.get(keyId) ?? []).filter(entry => entry.ts > cutoff)
  usage.push({ ts: Date.now(), tokens })
  keyTokenWindows.set(keyId, usage)
}
