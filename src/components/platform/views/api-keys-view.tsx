'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  KeyRound,
  Copy,
  Check,
  Trash2,
  Ban,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  masked: string
  scopes: string[]
  rateLimitPerMin: number
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

const ALL_SCOPES = [
  { id: 'tools:execute', label: 'Execute tools', description: 'Call /v1/execute' },
  { id: 'tools:read', label: 'Read tools', description: 'List catalog via /v1/tools' },
  { id: 'integrations:read', label: 'Read integrations', description: 'List connected apps' },
  { id: 'executions:read', label: 'Read executions', description: 'View execution history' },
  { id: 'playground:use', label: 'Use playground', description: 'Run AI agent' },
  { id: 'admin', label: 'Admin', description: 'Full access (all scopes)' },
]

export function ApiKeysView() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createdKey, setCreatedKey] = useState<{ secret: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ keys: ApiKey[] }>('/api/keys')
      setKeys(data.keys)
    } catch (e) {
      toast.error('Failed to load API keys', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleRevoke = async (k: ApiKey) => {
    try {
      await api(`/api/keys/${k.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'revoke' }) })
      toast.success('API key revoked')
      void load()
    } catch (e) {
      toast.error('Revoke failed', { description: (e as Error).message })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/keys/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('API key deleted')
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
          <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Programmatic keys for AI agents to call <code className="rounded bg-muted px-1 py-0.5 text-xs">/v1/execute</code>. Secrets are SHA-256 hashed — shown only once on creation.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5 self-start">
          <Plus className="h-4 w-4" /> Create Key
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <Card className="relative overflow-hidden border-dashed bg-gradient-to-br from-[#8A6D3B]/[0.04] via-transparent to-primary/[0.04] dark:from-[#8A6D3B]/10 dark:to-primary/10">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <KeyRound className="h-10 w-10" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-semibold">No API keys yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">Create a key so your AI agents can authenticate to AgentForge.</p>
            </div>
            <Button onClick={() => setShowCreate(true)} size="lg" className="mt-2 gap-1.5 shadow-md">
              <Plus className="h-4 w-4" /> Create your first key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id} className={cn('transition-all duration-200 hover:border-primary/30 hover:shadow-md', k.revokedAt && 'opacity-60')}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#8A6D3B]/10 text-[#8A6D3B]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 border-l-0 sm:border-l sm:pl-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    {k.revokedAt ? (
                      <Badge variant="destructive" className="gap-1 text-[10px]">
                        <Ban className="h-2.5 w-2.5" /> Revoked
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-primary text-[10px] text-primary-foreground hover:bg-primary">
                        <Check className="h-2.5 w-2.5" /> Active
                      </Badge>
                    )}
                    {k.scopes.includes('admin') && (
                      <Badge variant="secondary" className="gap-1 bg-[#A0533A]/10 text-[10px] text-[#A0533A] dark:bg-[#A0533A]/15 dark:text-[#A0533A]">
                        <ShieldAlert className="h-2.5 w-2.5" /> admin
                      </Badge>
                    )}
                  </div>
                  <code className="block rounded bg-muted/60 px-2 py-1 font-mono text-xs font-medium tracking-wide text-foreground/80">{k.masked}</code>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {k.lastUsedAt ? `Last used ${formatRelativeTime(k.lastUsedAt)}` : 'Never used'}
                    </span>
                    <span>·</span>
                    <span>{k.rateLimitPerMin}/min</span>
                    <span>·</span>
                    <span>Created {formatRelativeTime(k.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {k.scopes.filter((s) => s !== 'admin').map((s) => (
                      <ScopeBadge key={s} scope={s} />
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  {!k.revokedAt && (
                    <Button variant="ghost" size="sm" onClick={() => handleRevoke(k)} className="h-8 gap-1 text-xs text-[#8A6D3B] hover:text-[#8A6D3B]">
                      <Ban className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(k)} className="h-8 gap-1 text-xs text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateKeyDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(secret, name) => {
          setCreatedKey({ secret, name })
          void load()
        }}
      />
      <RevealKeyDialog data={createdKey} onClose={() => setCreatedKey(null)} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.name}</strong>. Any agent using this key will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (secret: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['tools:execute', 'tools:read'])
  const [rateLimit, setRateLimit] = useState(120)
  const [saving, setSaving] = useState(false)

  const toggleScope = (id: string) => {
    setScopes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Key name is required')
      return
    }
    setSaving(true)
    try {
      const res = await api<{ secret: string }>('/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), scopes, rateLimitPerMin: rateLimit }),
      })
      onCreated(res.secret, name.trim())
      setName('')
      setScopes(['tools:execute', 'tools:read'])
      setRateLimit(120)
      onOpenChange(false)
    } catch (e) {
      toast.error('Failed to create key', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#8A6D3B]" /> Create API Key
          </DialogTitle>
          <DialogDescription>
            The secret will be shown only once. Store it securely — we hash it with SHA-256 and cannot recover it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="keyname">Key Name</Label>
            <Input id="keyname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Agent" />
          </div>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="space-y-1.5">
              {ALL_SCOPES.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Switch checked={scopes.includes(s.id) || scopes.includes('admin')} onCheckedChange={() => toggleScope(s.id)} disabled={scopes.includes('admin') && s.id !== 'admin'} />
                    <div>
                      <div className="text-xs font-medium font-mono">{s.id}</div>
                      <div className="text-[11px] text-muted-foreground">{s.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Rate limit (requests / minute)</Label>
            <Input
              id="rate"
              type="number"
              min={1}
              max={600}
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">Sliding window. Hard cap: 600/min.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Generate Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScopeBadge({ scope }: { scope: string }) {
  const styles: Record<string, string> = {
    'tools:execute': 'border-primary/40 bg-primary/10 text-primary',
    'tools:read': 'border-[#6B5B4E]/30 bg-[#6B5B4E]/10 text-[#6B5B4E]',
    'integrations:read': 'border-[#8A6D3B]/30 bg-[#8A6D3B]/10 text-[#8A6D3B]',
    'executions:read': 'border-[#A0533A]/30 bg-[#A0533A]/10 text-[#A0533A]',
    'playground:use': 'border-[#8A6D3B]/30 bg-[#8A6D3B]/10 text-[#8A6D3B]',
  }
  return (
    <Badge variant="outline" className={cn('text-[10px] font-mono', styles[scope] ?? '')}>
      {scope}
    </Badge>
  )
}

function RevealKeyDialog({ data, onClose }: { data: { secret: string; name: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(false)

  const copy = () => {
    if (!data) return
    navigator.clipboard.writeText(data.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AlertDialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#8A6D3B]" /> Save your API key now
          </AlertDialogTitle>
          <AlertDialogDescription>
            This is the only time the full secret for <strong>{data?.name}</strong> will be displayed. Copy it now — we cannot show it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <code className="flex-1 break-all font-mono text-xs">
                {show ? data?.secret : 'af_live_••••••••••••••••••••••••'}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-[#8A6D3B]/8 p-3 text-xs text-[#8A6D3B] dark:bg-[#8A6D3B]/15 dark:text-[#8A6D3B]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Treat this key like a password. Do not commit it to source control or expose it in client-side code.</span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>I&apos;ve saved my key</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
