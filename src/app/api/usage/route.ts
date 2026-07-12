import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/usage — detailed usage analytics for charts
// Returns: executions by day (last 30 days), by provider, by hour-of-day,
// latency percentiles, and tool usage rankings.
export async function GET() {
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

  // Daily executions (last 30 days)
  const daily: { date: string; total: number; success: number; error: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const start = new Date(now - i * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const rows = await db.execution.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { status: true, durationMs: true },
    })
    daily.push({
      date: start.toISOString().slice(0, 10),
      total: rows.length,
      success: rows.filter((r) => r.status === 'success').length,
      error: rows.filter((r) => r.status !== 'success').length,
    })
  }

  // By provider (30 days)
  const byToolRaw = await db.execution.groupBy({
    by: ['toolId'],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: true,
    _avg: { durationMs: true },
  })
  const toolIds = byToolRaw.map((t) => t.toolId)
  const tools = await db.tool.findMany({ where: { id: { in: toolIds } }, select: { id: true, name: true, slug: true, provider: true, category: true } })
  const byProvider: Record<string, { count: number; avgMs: number }> = {}
  const byCategory: Record<string, { count: number; avgMs: number }> = {}
  const toolStats = byToolRaw.map((t) => {
    const tool = tools.find((tt) => tt.id === t.toolId)
    if (tool?.provider) {
      byProvider[tool.provider] = byProvider[tool.provider] ?? { count: 0, avgMs: 0 }
      byProvider[tool.provider].count += t._count
      byProvider[tool.provider].avgMs += (t._avg.durationMs ?? 0) * t._count
    }
    if (tool?.category) {
      byCategory[tool.category] = byCategory[tool.category] ?? { count: 0, avgMs: 0 }
      byCategory[tool.category].count += t._count
      byCategory[tool.category].avgMs += (t._avg.durationMs ?? 0) * t._count
    }
    return {
      tool: tool ? { name: tool.name, slug: tool.slug, provider: tool.provider, category: tool.category } : null,
      count: t._count,
      avgDurationMs: Math.round(t._avg.durationMs ?? 0),
    }
  }).sort((a, b) => b.count - a.count)

  // Finalize averages
  for (const p of Object.keys(byProvider)) byProvider[p].avgMs = Math.round(byProvider[p].avgMs / byProvider[p].count)
  for (const c of Object.keys(byCategory)) byCategory[c].avgMs = Math.round(byCategory[c].avgMs / byCategory[c].count)

  // Latency distribution
  const allDurations = await db.execution.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { durationMs: true, status: true },
  })
  const durations = allDurations.map((d) => d.durationMs).sort((a, b) => a - b)
  const pct = (p: number) => durations.length > 0 ? durations[Math.floor(durations.length * p)] ?? 0 : 0

  // By hour of day (aggregated over 30 days)
  const byHour: number[] = new Array(24).fill(0)
  const allExecs = await db.execution.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
  })
  for (const e of allExecs) byHour[e.createdAt.getHours()]++

  return NextResponse.json({
    range: { from: thirtyDaysAgo.toISOString(), to: new Date(now).toISOString() },
    daily,
    byProvider: Object.entries(byProvider).map(([provider, v]) => ({ provider, ...v })).sort((a, b) => b.count - a.count),
    byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.count - a.count),
    toolStats,
    latency: {
      p50: pct(0.5),
      p90: pct(0.9),
      p99: pct(0.99),
      avg: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      max: durations.length > 0 ? durations[durations.length - 1] : 0,
      samples: durations.length,
    },
    byHour,
    totalExecutions: allDurations.length,
    successCount: allDurations.filter((d) => d.status === 'success').length,
  })
}
