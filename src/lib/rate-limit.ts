// In-memory sliding-window rate limiter.
// Per-key (apiKeyId or ip) counters with 1-minute window.
// For production scale, swap with Redis; the interface stays the same.

interface Bucket {
  // timestamps of requests in the current window
  hits: number[]
}

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // epoch ms
  limit: number
}

/**
 * Check & consume one unit from a rate-limit bucket.
 * Returns whether allowed and remaining count.
 */
export function consume(key: string, limit: number): RateLimitResult {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  let b = buckets.get(key)
  if (!b) {
    b = { hits: [] }
    buckets.set(key, b)
  }
  // prune old hits
  b.hits = b.hits.filter((t) => t > cutoff)
  if (b.hits.length >= limit) {
    const oldest = b.hits[0] ?? now
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + WINDOW_MS,
      limit,
    }
  }
  b.hits.push(now)
  return {
    allowed: true,
    remaining: Math.max(0, limit - b.hits.length),
    resetAt: now + WINDOW_MS,
    limit,
  }
}

/**
 * Peek without consuming.
 */
export function peek(key: string, limit: number): RateLimitResult {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const b = buckets.get(key)
  const hits = (b?.hits ?? []).filter((t) => t > cutoff)
  return {
    allowed: hits.length < limit,
    remaining: Math.max(0, limit - hits.length),
    resetAt: (hits[0] ?? now) + WINDOW_MS,
    limit,
  }
}

/**
 * Reset a bucket (e.g. after key revocation we don't need this, but useful for tests).
 */
export function reset(key: string): void {
  buckets.delete(key)
}

// Periodic GC to keep memory bounded (every 5 min prune empty buckets)
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const cutoff = Date.now() - WINDOW_MS * 2
      for (const [k, b] of buckets) {
        b.hits = b.hits.filter((t) => t > cutoff)
        if (b.hits.length === 0) buckets.delete(k)
      }
    },
    5 * 60 * 1000,
  ).unref?.()
}
