'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Wrench,
  Plug,
  KeyRound,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { api, formatRelativeTime, formatDuration, statusColor } from '@/lib/api-client'
import { ProviderIcon } from '../provider-icon'
import { useLogsSocket, type LiveEvent } from '@/lib/live-socket'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Metrics {
  totals: { tools: number; enabledTools: number; integrations: number; activeIntegrations: number; apiKeys: number; activeApiKeys: number }
  last24h: { executions: number; success: number; errors: number; rateLimited: number; authFailed: number; timeout: number; successRate: number }
  statusBreakdown: Record<string, number>
  topTools: Array<{ id: string; name: string; slug: string; provider: string; category: string; count: number } & { iconKey?: string }>
  providerBreakdown: Record<string, number>
  hourly: Array<{ ts: number; success: number; error: number; other: number }>
}

interface Exec {
  id: string
  status: string
  tool: { slug: string; name: string; provider: string; category: string; iconKey: string }
  durationMs: number
  errorMessage: string | null
  createdAt: string
}

type ViewId = 'dashboard' | 'catalog' | 'integrations' | 'keys' | 'logs' | 'playground' | 'audit' | 'docs'

export function DashboardView({
  onNavigate,
  onLiveEvent,
}: {
  onNavigate: (v: ViewId) => void
  onLiveEvent: (ts: number) => void
}) {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recent, setRecent] = useState<Exec[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([api<Metrics>('/api/metrics'), api<{ executions: Exec[] }>('/api/executions?limit=8')])
      setMetrics(m)
      setRecent(e.executions)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  const onEvent = useCallback(
    (e: LiveEvent) => {
      onLiveEvent(Date.now())
      if (e.type === 'execution') {
        void load()
      }
    },
    [load, onLiveEvent],
  )
  const connected = useLogsSocket(onEvent)

  if (loading || !metrics) {
    return <DashboardSkeleton />
  }

  const chartData = metrics.hourly.map((h) => ({
    time: new Date(h.ts).toLocaleTimeString([], { hour: '2-digit' }),
    Success: h.success,
    Errors: h.error,
    'Rate Limited': h.other,
  }))

  const totalExec = metrics.last24h.executions || 1

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-primary/[0.04] to-primary/5 dark:from-primary/10 dark:via-primary/[0.06] dark:to-primary/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-primary/10 blur-3xl dark:bg-primary/10" aria-hidden />
        <CardContent className="relative flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Welcome to AgentForge</h2>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15 dark:text-primary">
                <Zap className="mr-1 h-3 w-3" /> Live
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              One unified API for AI agents to take real actions — send Slack messages, query Postgres, create GitHub issues, send emails, and more. We handle auth, rate limits, and error handling.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onNavigate('catalog')} variant="default" className="gap-1.5">
              <Wrench className="h-4 w-4" /> Browse Tools
            </Button>
            <Button onClick={() => onNavigate('playground')} variant="outline" className="gap-1.5">
              <Zap className="h-4 w-4" /> Try Playground
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Activity}
          label="Executions (24h)"
          value={metrics.last24h.executions}
          sub={`${metrics.last24h.success} successful`}
          trend={`${metrics.last24h.successRate}% success`}
          tone="emerald"
        />
        <KpiCard
          icon={Wrench}
          label="Available Tools"
          value={metrics.totals.enabledTools}
          sub={`${metrics.totals.tools} total in catalog`}
          trend="Production-ready"
          tone="violet"
        />
        <KpiCard
          icon={Plug}
          label="Connected Apps"
          value={metrics.totals.activeIntegrations}
          sub={`${metrics.totals.integrations} configured`}
          trend={metrics.totals.activeIntegrations > 0 ? 'Ready to use' : 'Connect one'}
          tone="sky"
        />
        <KpiCard
          icon={KeyRound}
          label="Active API Keys"
          value={metrics.totals.activeApiKeys}
          sub={`${metrics.totals.apiKeys} total`}
          trend={metrics.totals.activeApiKeys > 0 ? 'In use' : 'Create one'}
          tone="amber"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Execution Volume</CardTitle>
              <CardDescription className="text-xs">Last 24 hours, hourly buckets</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={connected
                ? 'gap-1.5 border-primary/40 text-primary dark:border-primary/40 dark:text-primary'
                : 'gap-1.5 border-muted bg-muted/40 text-muted-foreground'}
            >
              {connected ? (
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
              ) : (
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
              )}
              {connected ? 'Real-time' : 'Connecting…'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3D2B1F" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3D2B1F" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gError" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A0533A" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#A0533A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} className="text-muted-foreground" interval={3} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--popover))',
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="Success" stroke="#3D2B1F" strokeWidth={2} fill="url(#gSuccess)" />
                  <Area type="monotone" dataKey="Errors" stroke="#A0533A" strokeWidth={2} fill="url(#gError)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status Breakdown</CardTitle>
            <CardDescription className="text-xs">Last 24 hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <StatusRow icon={CheckCircle2} label="Success" value={metrics.last24h.success} total={totalExec} color="bg-[#5C7A52]" />
            <StatusRow icon={AlertTriangle} label="Errors" value={metrics.last24h.errors} total={totalExec} color="bg-[#A0533A]" />
            <StatusRow icon={Clock} label="Timeouts" value={metrics.last24h.timeout} total={totalExec} color="bg-[#6B5B4E]" />
            <StatusRow icon={KeyRound} label="Auth Failed" value={metrics.last24h.authFailed} total={totalExec} color="bg-[#A0533A]" />
            <StatusRow icon={Zap} label="Rate Limited" value={metrics.last24h.rateLimited} total={totalExec} color="bg-[#8A6D3B]" />
            <div className="mt-2 border-t pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Success rate</span>
                <span className="font-semibold text-primary">{metrics.last24h.successRate}%</span>
              </div>
              <Progress value={metrics.last24h.successRate} className="mt-1.5 h-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top tools + recent executions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Top Tools (24h)</CardTitle>
              <CardDescription className="text-xs">Most executed</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('catalog')} className="gap-1 text-xs">
              View all <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.topTools.length === 0 ? (
              <EmptyState icon={TrendingUp} text="No executions yet. Try the playground to generate activity." />
            ) : (
              metrics.topTools.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-accent/50">
                  <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                  <ProviderIcon iconKey={(t as any).iconKey ?? 'wrench'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.slug}</div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{t.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Recent Executions</CardTitle>
              <CardDescription className="text-xs">Latest tool calls</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('logs')} className="gap-1 text-xs">
              View logs <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recent.length === 0 ? (
              <EmptyState icon={Activity} text="No executions yet." />
            ) : (
              recent.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <ProviderIcon iconKey={e.tool.iconKey} size={14} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.tool.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{formatRelativeTime(e.createdAt)} · {formatDuration(e.durationMs)}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${statusColor(e.status)}`}>
                    {e.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  sub: string
  trend: string
  tone: 'emerald' | 'violet' | 'sky' | 'amber'
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-primary/10 text-primary',
    violet: 'bg-[#6B5B4E]/10 text-[#6B5B4E]',
    sky: 'bg-[#6B5B4E]/10 text-[#6B5B4E]',
    amber: 'bg-[#8A6D3B]/10 text-[#8A6D3B]',
  }
  const trendTones: Record<string, string> = {
    emerald: 'text-primary',
    violet: 'text-[#6B5B4E]',
    sky: 'text-[#6B5B4E]',
    amber: 'text-[#8A6D3B]',
  }
  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          </div>
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
          <span className={`shrink-0 text-xs font-semibold ${trendTones[tone]}`}>{trend}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusRow({ icon: Icon, label, value, total, color }: { icon: LucideIcon; label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-xs">{text}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}
