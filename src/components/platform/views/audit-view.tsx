'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, Filter, Search, User, KeyRound, Plug, Wrench, Bot, RefreshCw, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api, formatRelativeTime } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  action: string
  actorType: string
  actorId: string | null
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown>
  ipAddress: string | null
  userId: string | null
  createdAt: string
}

const ACTION_ICONS: Record<string, typeof ShieldCheck> = {
  'api_key.create': KeyRound,
  'api_key.revoke': KeyRound,
  'api_key.delete': KeyRound,
  'api_key.update': KeyRound,
  'integration.create': Plug,
  'integration.delete': Plug,
  'integration.update': Plug,
  'tool.execute': Wrench,
  'playground.run': Bot,
  'catalog.seed': RefreshCw,
}

const ACTION_LABELS: Record<string, string> = {
  'api_key.create': 'API Key Created',
  'api_key.revoke': 'API Key Revoked',
  'api_key.delete': 'API Key Deleted',
  'api_key.update': 'API Key Updated',
  'integration.create': 'Integration Created',
  'integration.delete': 'Integration Deleted',
  'integration.update': 'Integration Updated',
  'tool.execute': 'Tool Executed',
  'playground.run': 'Playground Run',
  'catalog.seed': 'Catalog Seeded',
}

// Distinct color classes per action type (verb-based earthy palette)
const ACTION_TONE: Record<string, string> = {
  'api_key.create': 'border-primary/40 bg-primary/10 text-primary',
  'integration.create': 'border-primary/40 bg-primary/10 text-primary',
  'api_key.revoke': 'border-[#8A6D3B]/30 bg-[#8A6D3B]/10 text-[#8A6D3B]',
  'api_key.update': 'border-[#6B5B4E]/30 bg-[#6B5B4E]/10 text-[#6B5B4E]',
  'integration.update': 'border-[#6B5B4E]/30 bg-[#6B5B4E]/10 text-[#6B5B4E]',
  'api_key.delete': 'border-[#A0533A]/30 bg-[#A0533A]/10 text-[#A0533A]',
  'integration.delete': 'border-[#A0533A]/30 bg-[#A0533A]/10 text-[#A0533A]',
  'tool.execute': 'border-[#5C7A52]/30 bg-[#5C7A52]/10 text-[#5C7A52]',
  'playground.run': 'border-[#8A6D3B]/30 bg-[#8A6D3B]/10 text-[#8A6D3B]',
  'catalog.seed': 'border-[#8A7E72]/30 bg-[#8A7E72]/10 text-[#8A7E72]',
}

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const data = await api<{ entries: AuditEntry[] }>('/api/audit?limit=100')
      setEntries(data.entries)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  const actions = Array.from(new Set(entries.map((e) => e.action))).sort()

  const filtered = entries.filter((e) => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false
    if (query) {
      const q = query.toLowerCase()
      return (
        e.action.includes(q) ||
        (e.actorId ?? '').includes(q) ||
        (e.targetId ?? '').includes(q) ||
        (e.ipAddress ?? '').includes(q) ||
        JSON.stringify(e.metadata).toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Audit Trail</h2>
        <p className="text-sm text-muted-foreground">
          Tamper-evident log of every security-relevant action: key creation/revocation, credential changes, tool executions, and more.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by action, actor, IP, or metadata…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Button variant={actionFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setActionFilter('all')} className="h-8 shrink-0 text-xs">All</Button>
          {actions.map((a) => (
            <Button key={a} variant={actionFilter === a ? 'default' : 'outline'} size="sm" onClick={() => setActionFilter(a)} className="h-8 shrink-0 text-xs">
              {ACTION_LABELS[a] ?? a}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
              <ShieldCheck className="h-10 w-10 opacity-40" />
              <p className="text-sm">No audit entries yet.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="divide-y">
                {filtered.map((e) => {
                  const Icon = ACTION_ICONS[e.action] ?? ShieldCheck
                  const label = ACTION_LABELS[e.action] ?? e.action
                  const tone = ACTION_TONE[e.action] ?? ''
                  const absoluteTime = new Date(e.createdAt).toLocaleString()
                  const hasMetadata = Object.keys(e.metadata).length > 0
                  return (
                    <div key={e.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{label}</span>
                          <Badge variant="outline" className={cn('text-[10px] font-mono', tone)}>{e.action}</Badge>
                          <Badge variant="outline" className="text-[10px]">{e.actorType}</Badge>
                          {e.ipAddress && <Badge variant="secondary" className="font-mono text-[10px]">{e.ipAddress}</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span title={absoluteTime}>{formatRelativeTime(e.createdAt)}</span>
                          {e.targetId && (
                            <>
                              <span>·</span>
                              <span>target: <code className="font-mono">{e.targetId.slice(-8)}</code></span>
                            </>
                          )}
                          {e.actorId && (
                            <>
                              <span>·</span>
                              <span>actor: <code className="font-mono">{e.actorId.slice(-8)}</code></span>
                            </>
                          )}
                        </div>
                        {hasMetadata && (
                          <details className="group mt-1 rounded-md border bg-muted/20 [&_summary]:cursor-pointer">
                            <summary className="flex select-none items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
                              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                              Metadata ({Object.keys(e.metadata).length})
                            </summary>
                            <pre className="max-h-48 overflow-auto border-t px-2 py-2 text-[10px]">{JSON.stringify(e.metadata, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground" title={absoluteTime}>{new Date(e.createdAt).toLocaleTimeString()}</span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
