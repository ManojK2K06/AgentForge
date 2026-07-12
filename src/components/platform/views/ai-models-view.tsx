'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Sparkles,
  Trash2,
  CheckCircle2,
  Zap,
  Loader2,
  Cpu,
  ExternalLink,
  Wifi,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api, formatRelativeTime } from '@/lib/api-client'
import { ProviderIcon } from '../provider-icon'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SupportedProvider {
  id: string
  name: string
  description: string
  defaultBaseUrl: string
  defaultModel: string
  models: string[]
  connectUrl: string | null
  connectLabel: string | null
}

interface ConfiguredProvider {
  id: string
  name: string
  provider: string
  providerLabel: string
  baseUrl: string
  model: string
  hasApiKey: boolean
  status: string
  createdAt: string
}

export function AiModelsView() {
  const [supported, setSupported] = useState<SupportedProvider[]>([])
  const [configured, setConfigured] = useState<ConfiguredProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConfiguredProvider | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ supported: SupportedProvider[]; configured: ConfiguredProvider[] }>('/api/llm-providers')
      setSupported(data.supported)
      setConfigured(data.configured)
    } catch (e) {
      toast.error('Failed to load AI providers', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/integrations/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('AI provider removed')
      setDeleteTarget(null)
      void load()
    } catch (e) {
      toast.error('Delete failed', { description: (e as Error).message })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">AI Models</h2>
          <p className="text-sm text-muted-foreground">
            Connect to ANY AI provider — OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral, Ollama, and more. The Playground uses your configured AI instead of the default.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5 self-start">
          <Plus className="h-4 w-4" /> Add AI Provider
        </Button>
      </div>

      {/* Current provider banner */}
      <Card className={cn('border-primary/30', configured.length === 0 && 'border-dashed')}>
        <CardContent className="flex items-center gap-4 p-5">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', configured.length > 0 ? 'bg-primary/10' : 'bg-muted')}>
            <Cpu className={cn('h-6 w-6', configured.length > 0 ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {configured.length > 0 ? 'Custom AI active' : 'Using built-in Z.ai (default)'}
              </span>
              {configured.length > 0 && (
                <Badge className="gap-1 text-[10px]">
                  <CheckCircle2 className="h-2.5 w-2.5" /> {configured.length} configured
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {configured.length > 0
                ? `The Playground and llm_chat tool use ${configured[0]!.providerLabel} (${configured[0]!.model}).`
                : 'Connect a provider below to use your own AI instead of the built-in Z.ai.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configured providers */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : configured.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No AI providers configured</p>
              <p className="text-xs text-muted-foreground">Add OpenAI, Anthropic, Gemini, Groq, or any OpenAI-compatible API.</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" /> Add your first AI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {configured.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <ProviderIcon iconKey="sparkles" size={18} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.name}</span>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <CheckCircle2 className="h-2.5 w-2.5" /> {c.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{c.model}</span>
                    <span>·</span>
                    <span className="truncate">{c.baseUrl}</span>
                    <span>·</span>
                    <span>Added {formatRelativeTime(c.createdAt)}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)} className="h-8 gap-1 text-xs text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Supported providers grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Supported Providers</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {supported.map((p) => (
            <Card key={p.id} className="group transition-all hover:border-primary/40 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ProviderIcon iconKey="sparkles" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-sm font-semibold">{p.name}</div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    {p.models.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.models.slice(0, 3).map((m) => (
                          <Badge key={m} variant="outline" className="text-[9px] font-mono">{m}</Badge>
                        ))}
                        {p.models.length > 3 && (
                          <Badge variant="outline" className="text-[9px]">+{p.models.length - 3}</Badge>
                        )}
                      </div>
                    )}
                    {p.connectUrl && (
                      <a
                        href={p.connectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 pt-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> {p.connectLabel}
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <CreateAiProviderDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        supported={supported}
        onCreated={load}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove AI provider?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{deleteTarget?.name}</strong>. The Playground will fall back to the built-in Z.ai LLM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreateAiProviderDialog({
  open,
  onOpenChange,
  supported,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  supported: SupportedProvider[]
  onCreated: () => void
}) {
  const [providerId, setProviderId] = useState('')
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; response?: string; latencyMs?: number; error?: string } | null>(null)

  const selected = supported.find((p) => p.id === providerId)

  const handleProviderChange = (id: string) => {
    setProviderId(id)
    const p = supported.find((sp) => sp.id === id)
    if (p) {
      setBaseUrl(p.defaultBaseUrl)
      setModel(p.defaultModel)
      setName(p.name)
      setTestResult(null)
    }
  }

  const handleTest = async () => {
    if (!baseUrl || !model) {
      toast.error('Base URL and model are required')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api<{ ok: boolean; response?: string; latencyMs?: number; error?: string }>('/api/llm-test', {
        method: 'POST',
        body: JSON.stringify({ provider: providerId, baseUrl, apiKey, model }),
      })
      setTestResult(res)
      if (res.ok) toast.success(`Connected! ${res.latencyMs}ms`)
      else toast.error(res.error ?? 'Connection failed')
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message })
      toast.error('Test failed', { description: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !providerId || !baseUrl || !model) {
      toast.error('Fill in all required fields')
      return
    }
    setSaving(true)
    try {
      await api('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          provider: providerId,
          credentials: { apiKey, baseUrl, model, provider: providerId },
        }),
      })
      toast.success('AI provider added', { description: 'The Playground will now use this AI.' })
      onOpenChange(false)
      onCreated()
      // Reset
      setProviderId('')
      setName('')
      setApiKey('')
      setBaseUrl('')
      setModel('')
      setTestResult(null)
    } catch (e) {
      toast.error('Failed to add provider', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTestResult(null) }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" /> Add AI Provider
          </DialogTitle>
          <DialogDescription>
            Connect any AI provider. The Playground will use this instead of the built-in Z.ai. Test the connection before saving.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={providerId} onValueChange={handleProviderChange}>
              <SelectTrigger><SelectValue placeholder="Choose an AI provider…" /></SelectTrigger>
              <SelectContent>
                {supported.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3" /> {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <>
              {selected.connectUrl && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Get your API key from {selected.name}:</span>
                    <a href={selected.connectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> {selected.connectLabel}
                    </a>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ai-name">Connection Name</Label>
                <Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production OpenAI" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-key">API Key</Label>
                <Input
                  id="ai-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={providerId === 'ollama' ? 'ollama' : 'sk-...'}
                  autoComplete="off"
                />
                {providerId === 'ollama' && (
                  <p className="text-[11px] text-muted-foreground">Ollama doesn&apos;t require a real key — enter &quot;ollama&quot;.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-baseurl">Base URL</Label>
                <Input id="ai-baseurl" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-model">Model</Label>
                {selected.models.length > 0 ? (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {selected.models.map((m) => (
                        <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="model-name" />
                )}
              </div>

              {/* Test connection */}
              <div className="space-y-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !baseUrl || !model} className="gap-1.5">
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  Test Connection
                </Button>
                {testResult && (
                  <div className={cn('rounded-lg border p-2.5 text-xs', testResult.ok ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5')}>
                    {testResult.ok ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        <span>Connected in {testResult.latencyMs}ms</span>
                        <span className="text-muted-foreground">— &quot;{testResult.response}&quot;</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>{testResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !providerId} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Save & Use This AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
