'use client'

import { useEffect } from 'react'

// Client-side schedule ticker.
// Calls /api/schedules/tick every 60 seconds to process due schedules.
// This ensures scheduled executions fire even without the external
// schedule-runner mini-service running. Multiple clients calling tick
// is safe — the endpoint is idempotent (each schedule's nextRunAt is
// updated atomically after execution).

export function ScheduleTicker() {
  useEffect(() => {
    const tick = () => {
      fetch('/api/schedules/tick', { method: 'POST' }).catch(() => {
        // Swallow errors — ticking is best-effort
      })
    }
    // Tick immediately on mount, then every 60s
    const timeout = setTimeout(tick, 3000)
    const interval = setInterval(tick, 60_000)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])
  return null
}
