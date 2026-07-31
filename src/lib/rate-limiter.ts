/**
 * Sliding-window rate limiter (per API key, in-memory).
 * Tracks request timestamps within the last 60 seconds.
 */

// keyId → array of request timestamps (ms)
const windows = new Map<string, number[]>()
const globalWindow: number[] = []
const tokenWindow: Array<{ ts: number; tokens: number }> = []

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
