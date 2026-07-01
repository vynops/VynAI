/**
 * Sliding-window rate limiter (per API key, in-memory).
 * Tracks request timestamps within the last 60 seconds.
 */

// keyId → array of request timestamps (ms)
const windows = new Map<string, number[]>()

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 * Automatically prunes stale timestamps.
 */
export function checkRateLimit(keyId: string, limitRpm: number): boolean {
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
