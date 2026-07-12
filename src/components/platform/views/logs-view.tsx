'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Activity,
  Filter,
  Pause,
  Play,
  Download,
  Search,
  ChevronRight,
  Loader2,
  Radio,
  RotateCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, formatRelativeTime, formatDuration, statusColor } from '@/lib/api-client'
import { useLogsSocket, type LiveEvent } from '@/lib/live-socket'
import { ProviderIcon } from '../provider-icon'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Exec {
  id: string
  status: string
  tool: { slug: string; name: string; provider: string; category: string; iconKey: string }
  durationMs: number
  errorMessage: string | null
  input: unknown
  output: unknown
  createdAt: string
}

interface LiveExec {
  id: string
  status: string
  toolSlug: string
  toolName: string
  category: string
  provider: string
  durationMs: number
  errorMessage?: string
  input: unknown
  ts: number
}

const STATUS_FILTERS = ['all', 'success', 'error', 'rate_limited', 'auth_failed', 'timeout'] as const

export function LogsView({ onLiveEvent }: { onLiveEvent: (ts: number) => void }) {
  const [executions, setExecutions] = useState<Exec[]>([])
  const [live, setLive] = useState<LiveExec[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Exec | LiveExec | null>(null)
  const liveRef = useRef<LiveExec[]>([])

  const load = useCallback(async () => {
    try {
      const data = await api<{ executions: Exec[] }>('/api/executions?limit=50')
      setExecutions(data.executions)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [load])

  const onEvent = useCallback(
    (e: LiveEvent) => {
      onLiveEvent(Date.now())
      if (e.type === 'execution' && !paused) {
        const exec = e.data as unknown as LiveExec
        liveRef.current = [exec, ...liveRef.current].slice(0, 100)
        setLive([...liveRef.current])
      }
    },
    [paused, onLiveEvent],
  )
  const connected = useLogsSocket(onEvent)

  // Merge live + historical, dedupe by id
  const merged = useMemo(() => {
    const map = new Map<string, Exec | LiveExec>()
    for (const e of live) map.set(e.id, e)
    for (const e of executions) {
      if (!map.has(e.id)) map.set(e.id, e)
    }
    let list = Array.from(map.values())
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter)
    if (query) {
      const q = query.toLowerCase()
      list = list.filter((e) => {
        const name = 'tool' in e ? e.tool.name : e.toolName
        const slug = 'tool' in e ? e.tool.slug : e.toolSlug
        return name.toLowerCase().includes(q) || slug.includes(q) || (e.errorMessage ?? '').toLowerCase().includes(q)
      })
    }
    return list.sort((a, b) => {
      const ta = 'ts' in a ? a.ts : new Date(a.createdAt).getTime()
      const tb = 'ts' in b ? b.ts : new Date(b.createdAt).getTime()
      return tb - ta
    })
  }, [live, executions, statusFilter, query])

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentforge-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Execution Logs</h2>
          <p className="text-sm text-muted-foreground">
            Every tool call is recorded with input, output, status, and latency. Streamed live over WebSocket.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={connected ? 'default' : 'outline'}
            className={cn(
              'gap-1.5',
              !connected && 'border-muted bg-muted/40 text-muted-foreground',
            )}
          >
            {connected ? (
              <Radio className="h-3 w-3 animate-pulse" />
            ) : (
              <Radio className="h-3 w-3 animate-pulse opacity-50" />
            )}
            {connected ? 'Live' : 'Connecting…'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} className="gap-1.5">
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by tool name, slug, or error…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          {STATUS_FILTERS.map((s) => {
            const active = statusFilter === s
            return (
              <Button
                key={s}
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'h-8 shrink-0 text-xs capitalize',
                  active && 'shadow-sm ring-2 ring-primary/30 ring-offset-1 ring-offset-background',
                )}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </Button>
            )
          })}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : merged.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
              <Activity className="h-10 w-10 opacity-40" />
              <p className="text-sm">No executions yet.</p>
              <p className="text-xs">Run a tool from the catalog or playground to see logs here.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[65vh]">
              <div className="divide-y">
                {merged.map((e, idx) => {
                  const isLive = 'ts' in e
                  const name = isLive ? e.toolName : e.tool.name
                  const slug = isLive ? e.toolSlug : e.tool.slug
                  const iconKey = isLive ? iconForProvider(e.provider) : e.tool.iconKey
                  const ts = isLive ? e.ts : new Date(e.createdAt).getTime()
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className={cn(
                        'flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                        idx % 2 === 1 && 'bg-muted/20',
                        statusBorder(e.status),
                      )}
                    >
                      {isLive && (
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                      )}
                      <ProviderIcon iconKey={iconKey} size={14} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{name}</span>
                          <code className="hidden text-[10px] text-muted-foreground sm:inline">{slug}</code>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{formatRelativeTime(ts)}</span>
                          <span>·</span>
                          <span>{formatDuration(e.durationMs)}</span>
                          {e.errorMessage && (
                            <>
                              <span>·</span>
                              <span className="truncate text-[#A0533A]">{e.errorMessage}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={cn('inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', statusColor(e.status))}>
                        {e.status}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <ExecDetailDialog exec={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function iconForProvider(p: string): string {
  const m: Record<string, string> = {
    slack: 'slack',
    github: 'github',
    postgres: 'database',
    smtp: 'mail',
    http: 'globe',
    webhook: 'webhook',
    llm: 'sparkles',
    salesforce: 'cloud',
  }
  return m[p] ?? 'wrench'
}

function statusBorder(status: string): string {
  switch (status) {
    case 'success':
      return 'border-l-[#5C7A52]'
    case 'error':
      return 'border-l-[#A0533A]'
    case 'rate_limited':
      return 'border-l-[#8A6D3B]'
    case 'auth_failed':
      return 'border-l-[#A0533A]'
    case 'timeout':
      return 'border-l-[#6B5B4E]'
    default:
      return 'border-l-muted-foreground/30'
  }
}

function ExecDetailDialog({ exec, onClose }: { exec: Exec | LiveExec | null; onClose: () => void }) {
  const [rerunning, setRerunning] = useState(false)
  const [rerunResult, setRerunResult] = useState<any>(null)
  if (!exec) return null
  const isLive = 'ts' in exec
  const name = isLive ? exec.toolName : exec.tool.name
  const slug = isLive ? exec.toolSlug : exec.tool.slug
  const iconKey = isLive ? iconForProvider(exec.provider) : exec.tool.iconKey
  const ts = isLive ? exec.ts : new Date(exec.createdAt).getTime()

  const handleRerun = async () => {
    if (isLive) {
      toast.error('Cannot re-run a live event. Wait for it to persist first.')
      return
    }
    setRerunning(true)
    setRerunResult(null)
    try {
      const res = await api<any>('/api/rerun', {
        method: 'POST',
        body: JSON.stringify({ executionId: exec.id }),
      })
      setRerunResult(res)
      if (res.status === 'success') toast.success('Re-run successful')
      else toast.error(res.error ?? 'Re-run failed')
    } catch (e) {
      toast.error('Re-run failed', { description: (e as Error).message })
    } finally {
      setRerunning(false)
    }
  }

  return (
    <Dialog open={!!exec} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <ProviderIcon iconKey={iconKey} size={18} />
            <span className="flex-1">{name}</span>
            <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', statusColor(exec.status))}>
              {exec.status}
            </span>
            {!isLive && (
              <Button variant="outline" size="sm" onClick={handleRerun} disabled={rerunning} className="gap-1.5 text-xs">
                {rerunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                Re-run
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border p-2.5">
              <div className="text-muted-foreground">Tool slug</div>
              <code className="font-mono">{slug}</code>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-muted-foreground">Duration</div>
              <span className="font-medium">{formatDuration(exec.durationMs)}</span>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-muted-foreground">Timestamp</div>
              <span className="font-medium">{new Date(ts).toLocaleString()}</span>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-muted-foreground">Execution ID</div>
              <code className="break-all font-mono text-[10px]">{exec.id}</code>
            </div>
          </div>

          {exec.errorMessage && (
            <div className="rounded-lg border border-[#A0533A]/20 bg-[#A0533A]/8 p-3">
              <div className="text-xs font-semibold text-[#A0533A]">Error</div>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-[#A0533A]">{exec.errorMessage}</pre>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input</div>
            <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">{JSON.stringify(exec.input ?? {}, null, 2)}</pre>
          </div>

          {'output' in exec && exec.output !== undefined && exec.output !== null && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output</div>
              <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">{JSON.stringify(exec.output, null, 2)}</pre>
            </div>
          )}

          {rerunResult && (
            <div className="rounded-lg border-2 border-dashed p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Re-run Result</span>
                <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', statusColor(rerunResult.status ?? 'error'))}>
                  {rerunResult.status}
                </span>
              </div>
              <pre className="max-h-40 overflow-auto text-xs">{JSON.stringify(rerunResult.output ?? rerunResult.error ?? {}, null, 2)}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

