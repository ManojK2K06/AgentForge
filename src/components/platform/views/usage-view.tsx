'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp,
  Zap,
  Clock,
  Activity,
  Gauge,
  BarChart3,
  Download,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { api, formatDuration } from '@/lib/api-client'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

interface UsageData {
  range: { from: string; to: string }
  daily: Array<{ date: string; total: number; success: number; error: number }>
  byProvider: Array<{ provider: string; count: number; avgMs: number }>
  byCategory: Array<{ category: string; count: number; avgMs: number }>
  toolStats: Array<{ tool: { name: string; slug: string; provider: string; category: string } | null; count: number; avgDurationMs: number }>
  latency: { p50: number; p90: number; p99: number; avg: number; max: number; samples: number }
  byHour: number[]
  totalExecutions: number
  successCount: number
}

const PROVIDER_COLORS: Record<string, string> = {
  slack: '#3D2B1F',
  github: '#6B5B4E',
  postgres: '#8A6D3B',
  smtp: '#A0533A',
  http: '#5C7A52',
  webhook: '#A0533A',
  llm: '#3D2B1F',
  salesforce: '#6B5B4E',
  notion: '#8A7E72',
  twilio: '#A0533A',
  linear: '#5C7A52',
}

const CATEGORY_COLORS: Record<string, string> = {
  communication: '#3D2B1F',
  database: '#8A6D3B',
  crm: '#6B5B4E',
  devops: '#6B5B4E',
  productivity: '#8A7E72',
  ai: '#3D2B1F',
  web: '#5C7A52',
}

export function UsageView() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const d = await api<UsageData>('/api/usage')
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const exportData = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentforge-usage-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  const successRate = data.totalExecutions > 0 ? (data.successCount / data.totalExecutions) * 100 : 0
  const dailyData = data.daily.map((d) => ({
    date: d.date.slice(5),
    Total: d.total,
    Success: d.success,
    Errors: d.error,
  }))
  const hourlyData = data.byHour.map((count, hour) => ({ hour: `${hour}:00`, executions: count }))
  const providerPieData = data.byProvider.map((p) => ({ name: p.provider, value: p.count }))
  const categoryBarData = data.byCategory.map((c) => ({ category: c.category, count: c.count, avgMs: c.avgMs }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Usage Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Deep insights into tool usage, latency, and reliability over the last 30 days.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportData} className="gap-1.5 self-start">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Activity} label="Total Executions (30d)" value={data.totalExecutions} sub={`${data.successCount} successful`} trend={`${Math.round(successRate * 10) / 10}% success rate`} tone="emerald" />
        <KpiCard icon={Gauge} label="Avg Latency" value={formatDuration(data.latency.avg)} sub={`P50: ${formatDuration(data.latency.p50)}`} trend={`P99: ${formatDuration(data.latency.p99)}`} tone="sky" />
        <KpiCard icon={Zap} label="Peak Hour" value={`${hourlyData.reduce((max, h) => h.executions > max.executions ? h : max, hourlyData[0] ?? { hour: '-', executions: 0 }).hour}`} sub={`${Math.max(...data.byHour)} executions`} trend="Busiest time" tone="amber" />
        <KpiCard icon={BarChart3} label="Active Tools" value={data.toolStats.length} sub={`${data.byProvider.length} providers`} trend="In use" tone="violet" />
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Daily Execution Trend</CardTitle>
            <CardDescription className="text-xs">Last 30 days · {data.totalExecutions} total executions</CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Activity className="h-3 w-3" /> {data.successCount} success
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            {data.totalExecutions === 0 ? (
              <ChartEmptyState text="No executions in the last 30 days" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={4} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                  <Bar dataKey="Success" radius={[3, 3, 0, 0]} maxBarSize={24}>
                    {dailyData.map((entry, i) => (
                      <Cell key={i} fill={entry.Success > 0 ? '#3D2B1F' : 'transparent'} />
                    ))}
                  </Bar>
                  <Bar dataKey="Errors" radius={[3, 3, 0, 0]} maxBarSize={24}>
                    {dailyData.map((entry, i) => (
                      <Cell key={i} fill={entry.Errors > 0 ? '#A0533A' : 'transparent'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hour of day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity by Hour</CardTitle>
            <CardDescription className="text-xs">When your agents are most active (30d)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              {data.totalExecutions === 0 ? (
                <ChartEmptyState text="No data yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} className="text-muted-foreground" interval={2} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                    <Bar dataKey="executions" radius={[3, 3, 0, 0]} maxBarSize={20}>
                      {hourlyData.map((entry, i) => (
                        <Cell key={i} fill={entry.executions > 0 ? '#3D2B1F' : '#E5DFD5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Provider pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Executions by Provider</CardTitle>
            <CardDescription className="text-xs">Distribution across integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              {providerPieData.length === 0 ? (
                <ChartEmptyState text="No data yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={providerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                      {providerPieData.map((entry, i) => (
                        <Cell key={i} fill={PROVIDER_COLORS[entry.name] ?? '#8A7E72'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latency + Top tools */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Latency Distribution</CardTitle>
            <CardDescription className="text-xs">{data.latency.samples} samples</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <LatencyRow label="P50 (median)" value={data.latency.p50} max={data.latency.max} />
            <LatencyRow label="P90" value={data.latency.p90} max={data.latency.max} />
            <LatencyRow label="P99" value={data.latency.p99} max={data.latency.max} />
            <LatencyRow label="Average" value={data.latency.avg} max={data.latency.max} />
            <LatencyRow label="Max" value={data.latency.max} max={data.latency.max} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Top Tools by Usage</CardTitle>
            <CardDescription className="text-xs">30-day execution count & avg latency</CardDescription>
          </CardHeader>
          <CardContent>
            {data.toolStats.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No executions yet</div>
            ) : (
              <div className="space-y-2">
                {data.toolStats.slice(0, 8).map((t, i) => {
                  const maxCount = data.toolStats[0]?.count ?? 1
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-mono text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium">{t.tool?.name ?? 'Unknown'}</span>
                          <span className="ml-2 shrink-0 text-muted-foreground">{formatDuration(t.avgDurationMs)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(t.count / maxCount) * 100}%`, backgroundColor: PROVIDER_COLORS[t.tool?.provider ?? ''] ?? '#8A7E72' }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">{t.count}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, trend, tone }: { icon: typeof Activity; label: string; value: string | number; sub: string; trend: string; tone: 'emerald' | 'sky' | 'amber' | 'violet' }) {
  const tones: Record<string, string> = {
    emerald: 'bg-primary/10 text-primary',
    sky: 'bg-[#6B5B4E]/10 text-[#6B5B4E]',
    amber: 'bg-[#8A6D3B]/10 text-[#8A6D3B]',
    violet: 'bg-[#6B5B4E]/10 text-[#6B5B4E]',
  }
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          </div>
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{sub}</span>
          <span className="font-medium">{trend}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function LatencyRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{formatDuration(value)}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  )
}

function ChartEmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <BarChart3 className="h-8 w-8 opacity-30" />
      <p className="text-xs">{text}</p>
    </div>
  )
}
