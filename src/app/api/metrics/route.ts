import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/metrics — dashboard metrics
export async function GET() {
  const now = Date.now()
  const since = new Date(now - 24 * 60 * 60 * 1000) // last 24h

  const [
    totalTools,
    enabledTools,
    totalIntegrations,
    activeIntegrations,
    totalKeys,
    activeKeys,
    executions24h,
    successCount,
    errorCount,
    rateLimitedCount,
    authFailedCount,
    timeoutCount,
  ] = await Promise.all([
    db.tool.count(),
    db.tool.count({ where: { enabled: true } }),
    db.integration.count(),
    db.integration.count({ where: { status: 'active' } }),
    db.apiKey.count(),
    db.apiKey.count({ where: { revokedAt: null } }),
    db.execution.count({ where: { createdAt: { gte: since } } }),
    db.execution.count({ where: { createdAt: { gte: since }, status: 'success' } }),
    db.execution.count({ where: { createdAt: { gte: since }, status: 'error' } }),
    db.execution.count({ where: { createdAt: { gte: since }, status: 'rate_limited' } }),
    db.execution.count({ where: { createdAt: { gte: since }, status: 'auth_failed' } }),
    db.execution.count({ where: { createdAt: { gte: since }, status: 'timeout' } }),
  ])

  const successRate = executions24h > 0 ? (successCount / executions24h) * 100 : 0

  // Group by hour for the last 24h (for the chart)
  const byHourRaw = await db.execution.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since } },
    _count: true,
  })
  const statusBreakdown = byHourRaw.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = r._count
    return acc
  }, {})

  // Top tools by execution count (24h)
  const topToolsRaw = await db.execution.groupBy({
    by: ['toolId'],
    where: { createdAt: { gte: since } },
    _count: true,
    orderBy: { _count: { toolId: 'desc' } },
    take: 6,
  })
  const toolIds = topToolsRaw.map((t) => t.toolId)
  const tools = await db.tool.findMany({ where: { id: { in: toolIds } }, select: { id: true, name: true, slug: true, provider: true, category: true } })
  const topTools = topToolsRaw.map((t) => ({
    ...tools.find((tt) => tt.id === t.toolId),
    count: t._count,
  }))

  // Executions by provider (24h)
  const providerBreakdown: Record<string, number> = {}
  for (const tt of topTools) {
    if (tt?.provider) providerBreakdown[tt.provider] = (providerBreakdown[tt.provider] ?? 0) + (tt.count ?? 0)
  }

  // Hourly buckets for chart (last 24h)
  const hourly: { ts: number; success: number; error: number; other: number }[] = []
  for (let i = 23; i >= 0; i--) {
    const start = new Date(now - i * 60 * 60 * 1000)
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const rows = await db.execution.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { status: true },
    })
    hourly.push({
      ts: start.getTime(),
      success: rows.filter((r) => r.status === 'success').length,
      error: rows.filter((r) => r.status === 'error' || r.status === 'auth_failed' || r.status === 'timeout').length,
      other: rows.filter((r) => r.status === 'rate_limited').length,
    })
  }

  return NextResponse.json({
    totals: {
      tools: totalTools,
      enabledTools,
      integrations: totalIntegrations,
      activeIntegrations,
      apiKeys: totalKeys,
      activeApiKeys: activeKeys,
    },
    last24h: {
      executions: executions24h,
      success: successCount,
      errors: errorCount,
      rateLimited: rateLimitedCount,
      authFailed: authFailedCount,
      timeout: timeoutCount,
      successRate: Math.round(successRate * 10) / 10,
    },
    statusBreakdown,
    topTools,
    providerBreakdown,
    hourly,
  })
}
