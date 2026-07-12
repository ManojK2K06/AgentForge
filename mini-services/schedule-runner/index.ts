// Schedule Runner — periodic worker that checks for due schedules and
// executes them via the Next.js /api/execute-internal endpoint.
// Port: none (background worker, polls every 60s).
//
// Each tick:
//   1. GET /api/schedules/due (returns schedules with nextRunAt <= now & enabled)
//   2. For each, POST /api/execute-internal with the tool + input
//   3. PATCH /api/schedules/[id] to update lastRunAt, nextRunAt, runCount, lastStatus

const POLL_INTERVAL_MS = 60_000
const API_BASE = 'http://localhost:3000'

async function tick() {
  try {
    // Fetch due schedules
    const dueRes = await fetch(`${API_BASE}/api/schedules/due`, { method: 'GET' })
    if (!dueRes.ok) return
    const { schedules } = (await dueRes.json()) as {
      schedules: Array<{ id: string; toolSlug: string; input: Record<string, unknown>; cronExpr: string }>
    }
    if (!schedules || schedules.length === 0) return

    console.log(`[schedule-runner] ${schedules.length} due schedule(s) to run`)

    for (const sched of schedules) {
      try {
        const execRes = await fetch(`${API_BASE}/api/execute-internal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: sched.toolSlug, input: sched.input }),
        })
        const execBody = await execRes.json().catch(() => ({}))
        const status = (execBody as { status?: string }).status ?? 'error'

        // Update the schedule
        await fetch(`${API_BASE}/api/schedules/${sched.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_run', status, cronExpr: sched.cronExpr }),
        }).catch(() => {})

        console.log(`[schedule-runner] schedule ${sched.id} (${sched.toolSlug}) -> ${status}`)
      } catch (e) {
        console.error(`[schedule-runner] failed to run schedule ${sched.id}:`, e)
      }
    }
  } catch (e) {
    console.error('[schedule-runner] tick error:', e)
  }
}

console.log('[schedule-runner] starting (polls every 60s)')
// Run immediately, then on interval
void tick()
setInterval(tick, POLL_INTERVAL_MS)

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
