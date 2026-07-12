'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  Wrench,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Zap,
  Cpu,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { api, formatDuration, statusColor } from '@/lib/api-client'
import { ProviderIcon } from '../provider-icon'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ToolCall {
  tool: string
  input: unknown
  output: unknown
  status: string
  error?: string
  durationMs: number
  executionId?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  pending?: boolean
}

const SUGGESTIONS = [
  'Send a Slack message to #general saying "Deployment complete!"',
  'List my GitHub repositories',
  'Generate a haiku about API integrations',
  'Create a GitHub issue titled "Fix login bug" in my repo',
]

export function PlaygroundView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set())
  const [llmProvider, setLlmProvider] = useState<string>('Z.ai (built-in)')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the latest message when messages change.
  // Uses scrollIntoView so it works with natural document flow (no fixed-height container).
  useEffect(() => {
    if (bottomRef.current && messages.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  // Check which AI provider is configured
  useEffect(() => {
    api<{ configured: Array<{ providerLabel: string; model: string }> }>('/api/llm-providers')
      .then((d) => {
        if (d.configured.length > 0) {
          setLlmProvider(`${d.configured[0]!.providerLabel} (${d.configured[0]!.model})`)
        }
      })
      .catch(() => {})
  }, [])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: msg }
    const pendingMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, userMsg, pendingMsg])
    setSending(true)
    try {
      const res = await api<{
        sessionId: string
        reply: string
        toolCalls: ToolCall[]
        iterations: number
        llmProvider?: string
      }>('/api/playground', {
        method: 'POST',
        body: JSON.stringify({ message: msg, sessionId }),
      })
      setSessionId(res.sessionId)
      if (res.llmProvider) setLlmProvider(res.llmProvider)
      setMessages((m) =>
        m.map((mm) =>
          mm.id === pendingMsg.id
            ? { ...mm, pending: false, content: res.reply, toolCalls: res.toolCalls }
            : mm,
        ),
      )
      if (res.toolCalls.length > 0) {
        toast.success(`Agent called ${res.toolCalls.length} tool${res.toolCalls.length > 1 ? 's' : ''}`)
      }
    } catch (e) {
      setMessages((m) =>
        m.map((mm) =>
          mm.id === pendingMsg.id
            ? { ...mm, pending: false, content: `Error: ${(e as Error).message}` }
            : mm,
        ),
      )
      toast.error('Agent failed', { description: (e as Error).message })
    } finally {
      setSending(false)
    }
  }

  const clear = () => {
    setMessages([])
    setSessionId(null)
  }

  const toggleCall = (id: string) => {
    setExpandedCalls((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">AI Playground</h2>
          <p className="text-sm text-muted-foreground">
            Chat with an AI agent that can call any tool. It decides which tools to use, executes them with your credentials, and reports back.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Cpu className="h-3 w-3" /> {llmProvider}
          </Badge>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clear} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="flex min-h-[400px] flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {/* Messages — grows naturally with content */}
          <div className="flex-1">
            <div className="space-y-4 p-4">
              {messages.length === 0 ? (
                <div className="flex min-h-[350px] flex-col items-center justify-center gap-4 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <Bot className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold">AgentForge AI Agent</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Ask me to do something with your connected tools — send messages, query databases, create issues, and more.
                    </p>
                  </div>
                  <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-lg border p-3 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent/50 hover:text-foreground"
                      >
                        <Sparkles className="mb-1 h-3 w-3 text-primary" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    expandedCalls={expandedCalls}
                    onToggleCall={toggleCall}
                  />
                ))
              )}
            </div>
            <div ref={bottomRef} />
          </div>

          {/* Input — sticky at bottom of the card */}
          <div className="sticky bottom-0 border-t bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder="Ask the agent to do something…"
                className="min-h-[44px] max-h-32 resize-none"
                disabled={sending}
              />
              <Button onClick={() => send()} disabled={sending || !input.trim()} className="h-11 gap-1.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Press Enter to send · Shift+Enter for newline · The agent uses your connected integrations automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MessageBubble({
  message,
  expandedCalls,
  onToggleCall,
}: {
  message: Message
  expandedCalls: Set<string>
  onToggleCall: (id: string) => void
}) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isUser ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground')}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn('flex max-w-[80%] flex-col gap-2', isUser && 'items-end')}>
        {message.pending ? (
          <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Agent is thinking…</span>
          </div>
        ) : (
          <div className={cn('rounded-xl px-4 py-2.5 text-sm', isUser ? 'bg-primary text-primary-foreground' : 'border bg-card')}>
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-strong:font-semibold prose-em:italic prose-a:text-primary prose-a:underline prose-h1:text-base prose-h1:font-bold prose-h2:text-sm prose-h2:font-bold prose-h3:text-sm prose-h3:font-semibold prose-blockquote:border-l-primary prose-blockquote:pl-3 prose-blockquote:italic prose-hr:my-2">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {message.toolCalls.map((tc, i) => (
              <ToolCallCard
                key={i}
                call={tc}
                expanded={expandedCalls.has(`${message.id}-${i}`)}
                onToggle={() => onToggleCall(`${message.id}-${i}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallCard({ call, expanded, onToggle }: { call: ToolCall; expanded: boolean; onToggle: () => void }) {
  const success = call.status === 'success'
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className={cn('rounded-lg border bg-card text-xs', success ? 'border-[#5C7A52]/30' : 'border-[#A0533A]/30')}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left">
          {success ? <CheckCircle2 className="h-3.5 w-3.5 text-[#5C7A52]" /> : <XCircle className="h-3.5 w-3.5 text-[#A0533A]" />}
          <ProviderIcon iconKey={iconForTool(call.tool)} size={12} />
          <code className="flex-1 truncate font-mono text-[11px]">{call.tool}</code>
          <span className={cn('inline-flex items-center rounded border px-1 py-0.5 text-[9px]', statusColor(call.status))}>{call.status}</span>
          <span className="text-muted-foreground">{formatDuration(call.durationMs)}</span>
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-3 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Input</div>
                <pre className="max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[10px]">{JSON.stringify(call.input ?? {}, null, 2)}</pre>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Output</div>
                {call.error ? (
                  <pre className="max-h-32 overflow-auto rounded bg-[#A0533A]/8 p-2 text-[10px] text-[#A0533A]">{call.error}</pre>
                ) : (
                  <pre className="max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[10px]">{JSON.stringify(call.output ?? null, null, 2)}</pre>
                )}
              </div>
            </div>
            {call.executionId && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                Execution ID: <code className="font-mono">{call.executionId}</code>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function iconForTool(slug: string): string {
  if (slug.startsWith('slack')) return 'slack'
  if (slug.startsWith('github')) return 'github'
  if (slug.startsWith('postgres')) return 'database'
  if (slug.startsWith('smtp') || slug.includes('email')) return 'mail'
  if (slug.startsWith('http')) return 'globe'
  if (slug.startsWith('webhook')) return 'webhook'
  if (slug.startsWith('llm')) return 'sparkles'
  if (slug.startsWith('salesforce')) return 'cloud'
  return 'wrench'
}
