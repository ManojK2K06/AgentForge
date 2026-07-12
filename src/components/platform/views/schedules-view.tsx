'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Pause,
  Calendar,
  Repeat,
  CheckCircle2,
  XCircle,
  Loader2,
  Timer,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { api, formatRelativeTime, statusColor } from '@/lib/api-client'
import { ProviderIcon } from '../provider-icon'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Schedule {
  id: string
  name: string
  toolSlug: string
  input: Record<string, unknown>
  cronExpr: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  runCount: number
  lastStatus: string | null
  createdAt: string
}

interface Tool {
  id: string
  slug: string
  name: string
  iconKey: string
  category: string
  provider: string
}

const PRESETS = [
  { value: 'every_5m', label: 'Every 5 minutes' },
  { value: 'every_15m', label: 'Every 15 minutes' },
  { value: 'every_30m', label: 'Every 30 minutes' },
  { value: 'every_1h', label: 'Every hour' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'every_12h', label: 'Every 12 hours' },
  { value: 'daily_09:00', label: 'Daily at 09:00' },
  { value: 'daily_18:00', label: 'Daily at 18:00' },
]

function iconForSlug(slug: string): string {
  if (slug.startsWith('slack')) return 'slack'
  if (slug.startsWith('github')) return 'github'
  if (slug.startsWith('postgres')) return 'database'
  if (slug.startsWith('smtp') || slug.includes('email')) return 'mail'
  if (slug.startsWith('http')) return 'globe'
  if (slug.startsWith('webhook')) return 'webhook'
  if (slug.startsWith('llm')) return 'sparkles'
  if (slug.startsWith('salesforce')) return 'cloud'
  if (slug.startsWith('notion')) return 'file-text'
  if (slug.startsWith('twilio')) return 'message-circle'
  if (slug.startsWith('linear')) return 'git-branch'
  return 'wrench'
}

export function SchedulesView() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)

  const load = useCallback(async () => {
    try {
      const [schedRes, toolRes] = await Promise.all([
        api<{ schedules: Schedule[] }>('/api/schedules'),
        api<{ tools: Tool[] }>('/api/tools'),
      ])
      setSchedules(schedRes.schedules)
      setTools(toolRes.tools)
    } catch (e) {
      toast.error('Failed to load schedules', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  const handleToggle = async (s: Schedule) => {
    try {
      await api(`/api/schedules/${s.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'toggle' }) })
      toast.success(s.enabled ? 'Schedule paused' : 'Schedule enabled')
      void load()
    } catch (e) {
      toast.error('Toggle failed', { description: (e as Error).message })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/schedules/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Schedule deleted')
      setDeleteTarget(null)
      void load()
    } catch (e) {
      toast.error('Delete failed', { description: (e as Error).message })
    }
  }

  const toolName = (slug: string) => tools.find((t) => t.slug === slug)?.name ?? slug

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Scheduled Executions</h2>
          <p className="text-sm text-muted-foreground">
            Automate recurring tool calls on a schedule. The runner checks every 60 seconds and executes due schedules.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5 self-start">
          <Plus className="h-4 w-4" /> New Schedule
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/15">
              <Clock className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No schedules yet</p>
              <p className="text-xs text-muted-foreground">Create a schedule to run a tool automatically on a recurring basis.</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" /> Create your first schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {schedules.map((s) => (
            <Card key={s.id} className={cn('transition-all', !s.enabled && 'opacity-60')}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <ProviderIcon iconKey={iconForSlug(s.toolSlug)} size={18} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                      <Badge variant={s.enabled ? 'default' : 'secondary'} className="gap-1 text-[10px]">
                        {s.enabled ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                        {s.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{toolName(s.toolSlug)}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Repeat className="h-3 w-3" /> {s.cronExpr.replace('_', ' ')}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" /> {s.runCount} runs
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {s.nextRunAt && s.enabled && (
                        <span className="text-primary">
                          Next: {formatRelativeTime(s.nextRunAt)}
                        </span>
                      )}
                      {s.lastRunAt && (
                        <span className="text-muted-foreground">
                          Last: {formatRelativeTime(s.lastRunAt)}
                        </span>
                      )}
                      {s.lastStatus && (
                        <span className={cn('inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-medium', statusColor(s.lastStatus))}>
                          {s.lastStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggle(s)}>
                      {s.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateScheduleDialog open={showCreate} onOpenChange={setShowCreate} tools={tools} onCreated={load} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.name}</strong>. Future runs will not occur.
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

function CreateScheduleDialog({
  open,
  onOpenChange,
  tools,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tools: Tool[]
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [toolSlug, setToolSlug] = useState('')
  const [cronExpr, setCronExpr] = useState('every_1h')
  const [inputJson, setInputJson] = useState('{}')
  const [saving, setSaving] = useState(false)

  const selectedTool = tools.find((t) => t.slug === toolSlug)

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error('Name is required')
    if (!toolSlug) return toast.error('Select a tool')
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(inputJson)
    } catch {
      return toast.error('Input JSON is invalid')
    }
    setSaving(true)
    try {
      await api('/api/schedules', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), toolSlug, input: parsed, cronExpr }),
      })
      toast.success('Schedule created')
      setName('')
      setToolSlug('')
      setCronExpr('every_1h')
      setInputJson('{}')
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error('Failed to create schedule', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> New Scheduled Execution
          </DialogTitle>
          <DialogDescription>Run a tool automatically on a recurring schedule.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sched-name">Schedule Name</Label>
            <Input id="sched-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily standup reminder" />
          </div>
          <div className="space-y-2">
            <Label>Tool</Label>
            <Select value={toolSlug} onValueChange={(v) => {
              setToolSlug(v)
              const t = tools.find((tt) => tt.slug === v)
              if (t) {
                // load the tool schema to build sample input
                api<{ tools: any[] }>('/api/tools').then((d) => {
                  const full = d.tools.find((tt) => tt.slug === v)
                  if (full?.inputSchema?.properties) {
                    const sample: Record<string, unknown> = {}
                    for (const [k, p] of Object.entries<any>(full.inputSchema.properties)) {
                      if (p.type === 'string') sample[k] = ''
                      else if (p.type === 'integer' || p.type === 'number') sample[k] = 0
                      else if (p.type === 'boolean') sample[k] = false
                      else if (p.type === 'array') sample[k] = []
                      else if (p.type === 'object') sample[k] = {}
                    }
                    setInputJson(JSON.stringify(sample, null, 2))
                  }
                }).catch(() => {})
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Choose a tool…" /></SelectTrigger>
              <SelectContent>
                {tools.map((t) => (
                  <SelectItem key={t.id} value={t.slug}>
                    <span className="flex items-center gap-2">
                      <ProviderIcon iconKey={t.iconKey} size={12} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Schedule</Label>
            <Select value={cronExpr} onValueChange={setCronExpr}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" /> {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sched-input">Input JSON</Label>
            <Textarea
              id="sched-input"
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="h-32 font-mono text-xs"
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground">
              This input will be passed to <code className="font-mono">{selectedTool?.slug ?? 'the tool'}</code> on each run.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
