'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Plug,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  ExternalLink,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, formatRelativeTime } from '@/lib/api-client'
import { ProviderIcon } from '../provider-icon'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Integration {
  id: string
  name: string
  provider: string
  providerLabel: string
  authScheme: string
  status: string
  lastValidatedAt: string | null
  createdAt: string
  credentialKeys: { key: string; label: string; required: boolean }[]
}

const PROVIDERS = [
  { id: 'slack', label: 'Slack', icon: 'slack', description: 'Send messages, list channels', connectUrl: 'https://api.slack.com/apps?new_app=1', connectLabel: 'Create Slack App' },
  { id: 'github', label: 'GitHub', icon: 'github', description: 'Issues, repositories', connectUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=AgentForge', connectLabel: 'Create GitHub Token' },
  { id: 'postgres', label: 'PostgreSQL', icon: 'database', description: 'SQL queries (read-only)', connectUrl: null, connectLabel: null },
  { id: 'smtp', label: 'SMTP Email', icon: 'mail', description: 'Transactional email', connectUrl: null, connectLabel: null },
  { id: 'http', label: 'HTTP / REST', icon: 'globe', description: 'Generic HTTP client', connectUrl: null, connectLabel: null },
  { id: 'webhook', label: 'Webhook', icon: 'webhook', description: 'Outgoing webhooks', connectUrl: null, connectLabel: null },
  { id: 'llm', label: 'LLM (Z.ai)', icon: 'sparkles', description: 'Built-in AI model', connectUrl: null, connectLabel: null },
  { id: 'salesforce', label: 'Salesforce', icon: 'cloud', description: 'CRM records', connectUrl: 'https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth.htm', connectLabel: 'Salesforce OAuth Setup' },
  { id: 'notion', label: 'Notion', icon: 'file-text', description: 'Create & search pages', connectUrl: 'https://www.notion.so/my-integrations/new', connectLabel: 'Create Notion Integration' },
  { id: 'twilio', label: 'Twilio (SMS)', icon: 'message-circle', description: 'Send SMS messages', connectUrl: 'https://console.twilio.com/', connectLabel: 'Twilio Console' },
  { id: 'linear', label: 'Linear', icon: 'git-branch', description: 'Create issues', connectUrl: 'https://linear.app/settings/api', connectLabel: 'Linear API Keys' },
]

const CREDENTIAL_FIELDS: Record<string, { key: string; label: string; type: string; required: boolean; placeholder?: string; help?: string }[]> = {
  slack: [{ key: 'botToken', label: 'Bot OAuth Token', type: 'password', required: true, placeholder: 'xoxb-...', help: 'Requires chat:write and channels:read scopes' }],
  github: [{ key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_...', help: 'Requires repo scope' }],
  postgres: [{ key: 'connectionString', label: 'Connection String', type: 'password', required: true, placeholder: 'postgresql://user:pass@host:5432/db' }],
  smtp: [
    { key: 'host', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '587' },
    { key: 'user', label: 'Username', type: 'text', required: true, placeholder: 'you@example.com' },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'from', label: 'From Address', type: 'text', required: true, placeholder: 'You <you@example.com>' },
  ],
  http: [{ key: 'token', label: 'Default Bearer Token', type: 'password', required: false }],
  webhook: [
    { key: 'url', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://hooks.example.com/...' },
    { key: 'secret', label: 'Signing Secret', type: 'password', required: false },
  ],
  llm: [],
  salesforce: [
    { key: 'instanceUrl', label: 'Instance URL', type: 'text', required: true, placeholder: 'https://myorg.my.salesforce.com' },
    { key: 'accessToken', label: 'Session / Access Token', type: 'password', required: true },
  ],
  notion: [{ key: 'token', label: 'Integration Token', type: 'password', required: true, placeholder: 'secret_...', help: 'Create at notion.so/my-integrations' }],
  twilio: [
    { key: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'AC...' },
    { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
    { key: 'fromNumber', label: 'From Number (E.164)', type: 'text', required: true, placeholder: '+15551234567' },
  ],
  linear: [{ key: 'apiKey', label: 'Personal API Key', type: 'password', required: true, placeholder: 'lin_api_...' }],
}

const SETUP_GUIDES: Record<string, string> = {
  slack: 'Create a Slack app, add bot token scopes (chat:write, channels:read), install to your workspace, then copy the Bot User OAuth Token (xoxb-...).',
  github: 'Generate a personal access token with "repo" scope. Copy it immediately — GitHub won\'t show it again.',
  postgres: 'Use your database connection string: postgresql://user:password@host:port/database. For production, create a read-only user.',
  smtp: 'For Gmail, use an App Password (not your regular password). Port 587 for TLS, 465 for SSL. Other providers: use your standard SMTP credentials.',
  http: 'No setup required. Pass authentication per-request via the authHeaderValue field, or set a default bearer token here.',
  webhook: 'Create a webhook endpoint in n8n, Make, Zapier, or IFTTT. Paste the URL here. Optionally add a signing secret for HMAC verification.',
  llm: 'No setup required. The LLM tool uses the built-in Z.ai model and works out of the box.',
  salesforce: 'Create a Connected App in Salesforce Setup → App Manager. Enable OAuth with API scopes. Obtain the instance URL and access token.',
  notion: 'Create an integration at notion.so/my-integrations. Copy the Internal Integration Secret. Then share the target database with the integration.',
  twilio: 'Sign up at twilio.com. Find your Account SID and Auth Token in the console. Get a phone number (trial accounts get one free).',
  linear: 'Go to Linear Settings → API → Personal API keys. Create a new key. You\'ll also need your Team ID from workspace settings.',
}

const CONNECT_LINKS: Record<string, { url: string; label: string }> = {
  slack: { url: 'https://api.slack.com/apps?new_app=1', label: 'Create Slack App' },
  github: { url: 'https://github.com/settings/tokens/new?scopes=repo&description=AgentForge', label: 'Create GitHub Token' },
  salesforce: { url: 'https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth.htm', label: 'Salesforce OAuth Setup' },
  notion: { url: 'https://www.notion.so/my-integrations/new', label: 'Create Notion Integration' },
  twilio: { url: 'https://console.twilio.com/', label: 'Twilio Console' },
  linear: { url: 'https://linear.app/settings/api', label: 'Linear API Keys' },
}

export function IntegrationsView() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ integrations: Integration[] }>('/api/integrations')
      setIntegrations(data.integrations)
    } catch (e) {
      toast.error('Failed to load integrations', { description: (e as Error).message })
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
      toast.success('Integration deleted')
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
          <h2 className="text-2xl font-bold tracking-tight">Connected Apps</h2>
          <p className="text-sm text-muted-foreground">
            Securely store credentials for each provider. Credentials are AES-256-GCM encrypted at rest and never returned in plaintext.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5 self-start">
          <Plus className="h-4 w-4" /> New Connection
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <Card className="relative overflow-hidden border-dashed bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.04] dark:from-primary/10 dark:to-primary/10">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Plug className="h-10 w-10" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-semibold">No connections yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">Connect Slack, GitHub, Postgres, and more to enable tool execution.</p>
            </div>
            <Button onClick={() => setShowCreate(true)} size="lg" className="mt-2 gap-1.5 shadow-md">
              <Plus className="h-4 w-4" /> Connect your first app
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map((i) => (
            <Card key={i.id} className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
                <ProviderIcon iconKey={i.provider} />
                <div className="min-w-0 flex-1 space-y-1">
                  <CardTitle className="text-base leading-tight">{i.name}</CardTitle>
                  <CardDescription className="text-xs">{i.providerLabel} · {i.authScheme}</CardDescription>
                </div>
                {i.status === 'active' ? (
                  <Badge className="gap-1 bg-primary text-[10px] text-primary-foreground hover:bg-primary">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <AlertCircle className="h-3 w-3" /> {i.status}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {i.credentialKeys.map((c) => (
                    <Badge key={c.key} variant="outline" className="gap-1 text-[10px]">
                      <Lock className="h-2.5 w-2.5" /> {c.label}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>Created {formatRelativeTime(i.createdAt)}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast.info('Credentials are encrypted and cannot be viewed. Update them to rotate.')}
                      className="h-7 gap-1 text-xs"
                    >
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(i)}
                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Provider Directory — direct links to get credentials */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="h-4 w-4 text-primary" /> Provider Directory
          </CardTitle>
          <CardDescription className="text-xs">
            Direct links to each provider&apos;s credential setup page. Click to open in a new tab, get your credentials, then come back and create the connection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.filter((p) => p.connectUrl).map((p) => (
              <a
                key={p.id}
                href={p.connectUrl!}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-lg border p-2.5 transition-all hover:border-primary/40 hover:bg-accent/50"
              >
                <ProviderIcon iconKey={p.icon} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.connectLabel}</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <CreateIntegrationDialog open={showCreate} onOpenChange={setShowCreate} onCreated={load} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.name}</strong> and its encrypted credentials. Tools that rely on this connection will fail until reconnected. This action cannot be undone.
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

function CreateIntegrationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [provider, setProvider] = useState('')
  const [name, setName] = useState('')
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setProvider('')
    setName('')
    setCreds({})
    setShow({})
  }

  const fields = provider ? CREDENTIAL_FIELDS[provider] ?? [] : []

  const handleSubmit = async () => {
    if (!provider) {
      toast.error('Select a provider')
      return
    }
    if (!name.trim()) {
      toast.error('Connection name is required')
      return
    }
    for (const f of fields) {
      if (f.required && !creds[f.key]?.trim()) {
        toast.error(`${f.label} is required`)
        return
      }
    }
    setSaving(true)
    try {
      await api('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), provider, credentials: creds }),
      })
      toast.success('Connection created', { description: 'Credentials encrypted and stored.' })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error('Failed to create connection', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> New Connection
          </DialogTitle>
          <DialogDescription>
            Credentials are encrypted with AES-256-GCM before storage. They are never logged or returned in API responses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); setName(name || p.label) }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all hover:border-primary/40 hover:bg-accent/40',
                    provider === p.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : '',
                  )}
                >
                  <ProviderIcon iconKey={p.icon} />
                  <span className="text-xs font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {provider && (
            <>
              {/* Setup guide + direct link */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 dark:border-primary/30 dark:bg-primary/10">
                <div className="flex items-start gap-2">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {SETUP_GUIDES[provider] ?? 'Enter your credentials below. They will be encrypted before storage.'}
                    </p>
                    {CONNECT_LINKS[provider] && (
                      <a
                        href={CONNECT_LINKS[provider]!.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <ExternalLink className="h-3 w-3" /> {CONNECT_LINKS[provider]!.label}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Connection Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Slack" />
              </div>
              {fields.length > 0 && (
                <div className="space-y-3">
                  <Label>Credentials</Label>
                  {fields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={f.key} className="text-xs">
                          {f.label}
                          {f.required && <span className="ml-1 text-destructive">*</span>}
                        </Label>
                        {f.type === 'password' && (
                          <button
                            type="button"
                            onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            {show[f.key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                      <Input
                        id={f.key}
                        type={f.type === 'password' && !show[f.key] ? 'password' : 'text'}
                        value={creds[f.key] ?? ''}
                        onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        autoComplete="off"
                      />
                      {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                    </div>
                  ))}
                </div>
              )}
              {provider === 'llm' && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  The LLM provider uses the built-in Z.ai model. No credentials required.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !provider} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Encrypt & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
