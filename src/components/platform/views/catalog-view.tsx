'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Search,
  Wrench,
  Filter,
  Copy,
  Check,
  Play,
  Loader2,
  ArrowRight,
  Code2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, statusColor, formatDuration } from '@/lib/api-client'
import { ProviderIcon } from '../provider-icon'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Tool {
  id: string
  slug: string
  name: string
  description: string
  category: string
  provider: string
  authScheme: string
  iconKey: string
  inputSchema: { type: 'object'; properties: Record<string, any>; required: string[] }
  isBeta: boolean
  enabled: boolean
}

interface Integration {
  id: string
  name: string
  provider: string
  providerLabel: string
  status: string
}

const CATEGORIES = ['all', 'communication', 'database', 'crm', 'devops', 'productivity', 'ai', 'web'] as const

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Communication',
  database: 'Database',
  crm: 'CRM',
  devops: 'DevOps',
  productivity: 'Productivity',
  ai: 'AI',
  web: 'Web',
}

export function CatalogView() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [selected, setSelected] = useState<Tool | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ tools: Tool[] }>('/api/tools')
      setTools(data.tools)
    } catch (e) {
      toast.error('Failed to load tools', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return tools.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (query) {
        const q = query.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.slug.includes(q)
      }
      return true
    })
  }, [tools, query, category])

  const byCategory = useMemo(() => {
    const map: Record<string, Tool[]> = {}
    for (const t of filtered) {
      ;(map[t.category] ??= []).push(t)
    }
    return map
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Tool Catalog</h2>
        <p className="text-sm text-muted-foreground">
          Pre-built, production-ready tools that AI agents can call. Each tool handles authentication, validation, and error normalisation.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools by name, description, or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={category === c ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategory(c)}
              className="h-8 shrink-0 text-xs capitalize"
            >
              {c === 'all' ? 'All' : CATEGORY_LABELS[c] ?? c}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 opacity-40" />
            <p className="text-sm">No tools match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([cat, catTools]) => (
            <div key={cat} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold uppercase tracking-wider text-foreground">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h3>
                <Badge variant="secondary" className="font-mono text-[11px] tabular-nums">{catTools.length}</Badge>
                <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {catTools.map((t, idx) => (
                  <ToolCard key={t.id} tool={t} featured={idx === 0} onOpen={() => setSelected(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ToolDetailDialog tool={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function ToolCard({ tool, featured, onOpen }: { tool: Tool; featured?: boolean; onOpen: () => void }) {
  return (
    <Card
      className={cn(
        'group relative cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
        featured && 'border-primary/40 bg-gradient-to-br from-primary/[0.04] to-transparent ring-1 ring-primary/20',
      )}
      onClick={onOpen}
    >
      {featured && (
        <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />
      )}
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        <ProviderIcon iconKey={tool.iconKey} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base leading-tight">{tool.name}</CardTitle>
            {tool.isBeta && <Badge variant="secondary" className="text-[10px]">Beta</Badge>}
          </div>
          <CardDescription className="text-xs font-mono">{tool.slug}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] capitalize">{tool.category}</Badge>
          <Badge variant="outline" className="text-[10px]">{tool.authScheme}</Badge>
          <Badge variant="outline" className="text-[10px] capitalize">{tool.provider}</Badge>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            <Code2 className="h-3 w-3" />
            {Object.keys(tool.inputSchema.properties).length} params
          </Badge>
          <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Details <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function ToolDetailDialog({ tool, onClose }: { tool: Tool | null; onClose: () => void }) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [inputJson, setInputJson] = useState('{}')
  const [integrationId, setIntegrationId] = useState<string>('auto')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (tool) {
      // Build a sample input from the schema
      const sample: Record<string, unknown> = {}
      for (const [k, p] of Object.entries(tool.inputSchema.properties)) {
        if (p.type === 'string') sample[k] = p.default ?? ''
        else if (p.type === 'integer' || p.type === 'number') sample[k] = p.default ?? 0
        else if (p.type === 'boolean') sample[k] = false
        else if (p.type === 'array') sample[k] = []
        else if (p.type === 'object') sample[k] = {}
      }
      setInputJson(JSON.stringify(sample, null, 2))
      setResult(null)
      // load integrations matching this provider
      api<{ integrations: Integration[] }>('/api/integrations')
        .then((d) => setIntegrations(d.integrations.filter((i) => i.provider === tool.provider)))
        .catch(() => setIntegrations([]))
    }
  }, [tool])

  if (!tool) return null

  const codeSnippet = `curl -X POST https://api.agentforge.dev/v1/execute \\
  -H "Authorization: Bearer $AGENTFORGE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "${tool.slug}",
    "input": ${JSON.stringify(JSON.parse(inputJson || '{}'))},
    "integrationId": ${integrationId === 'auto' ? null : `"${integrationId}"`}
  }'`

  const handleExecute = async () => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(inputJson)
    } catch {
      toast.error('Input JSON is invalid')
      return
    }
    setExecuting(true)
    setResult(null)
    try {
      const body: Record<string, unknown> = { tool: tool.slug, input: parsed }
      if (integrationId !== 'auto') body.integrationId = integrationId
      // Use the dashboard-internal execution endpoint (no API key needed,
      // uses the operator's connected integrations directly).
      const res = await api<any>('/api/execute-internal', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setResult(res)
      if (res.status === 'success') {
        toast.success('Tool executed successfully')
      } else {
        toast.error(res.error ?? res.status ?? 'Execution failed')
      }
    } catch (e) {
      toast.error('Execution failed', { description: (e as Error).message })
    } finally {
      setExecuting(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  return (
    <Dialog open={!!tool} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-start gap-3">
            <ProviderIcon iconKey={tool.iconKey} size={18} />
            <div className="flex-1 space-y-1">
              <DialogTitle className="text-lg">{tool.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono">{tool.slug}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{tool.category}</Badge>
                <Badge variant="outline" className="text-[10px]">{tool.authScheme}</Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="schema" className="flex h-[calc(90vh-180px)] flex-col">
          <TabsList className="mx-6 mt-2 grid w-fit grid-cols-3">
            <TabsTrigger value="schema" className="gap-1.5 text-xs"><Code2 className="h-3.5 w-3.5" /> Schema</TabsTrigger>
            <TabsTrigger value="execute" className="gap-1.5 text-xs"><Play className="h-3.5 w-3.5" /> Try it</TabsTrigger>
            <TabsTrigger value="code" className="gap-1.5 text-xs"><Code2 className="h-3.5 w-3.5" /> Code</TabsTrigger>
          </TabsList>

          <TabsContent value="schema" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 px-6 py-4">
                <p className="text-sm text-muted-foreground">{tool.description}</p>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input Parameters</h4>
                  {Object.entries(tool.inputSchema.properties).map(([key, prop]: [string, any]) => {
                    const required = tool.inputSchema.required.includes(key)
                    return (
                      <div key={key} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-medium">{key}</code>
                          <Badge variant="outline" className="text-[10px]">{prop.type}</Badge>
                          {required && <Badge variant="destructive" className="text-[10px]">required</Badge>}
                          {prop.enum && <Badge variant="secondary" className="text-[10px]">{prop.enum.join(' | ')}</Badge>}
                        </div>
                        {prop.description && <p className="mt-1 text-xs text-muted-foreground">{prop.description}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="execute" className="mt-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col gap-3 px-6 py-4">
              <div className="space-y-2">
                <Label className="text-xs">Integration</Label>
                <Select value={integrationId} onValueChange={setIntegrationId}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-select (first active)</SelectItem>
                    {integrations.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name} · {i.providerLabel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {integrations.length === 0 && tool.authScheme !== 'none' && (
                  <p className="text-xs text-[#8A6D3B]">
                    No {tool.provider} integration connected. Execution will fail with auth error. Connect one in Connected Apps.
                  </p>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-xs">Input JSON</Label>
                <Textarea
                  value={inputJson}
                  onChange={(e) => setInputJson(e.target.value)}
                  className="h-40 font-mono text-xs"
                  spellCheck={false}
                />
              </div>
              {result && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold">Result</span>
                    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', statusColor(result.status ?? 'error'))}>
                      {result.status ?? 'error'}
                    </span>
                  </div>
                  <pre className="max-h-32 overflow-auto text-xs">{JSON.stringify(result.output ?? result.reply ?? result, null, 2)}</pre>
                </div>
              )}
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button onClick={handleExecute} disabled={executing} className="gap-1.5">
                  {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Execute Tool
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="code" className="mt-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col px-6 py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">cURL</span>
                <Button variant="ghost" size="sm" onClick={copyCode} className="h-7 gap-1 text-xs">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <pre className="rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed">{codeSnippet}</pre>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
