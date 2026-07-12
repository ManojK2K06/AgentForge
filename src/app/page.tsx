'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LayoutDashboard,
  Wrench,
  Plug,
  KeyRound,
  Activity,
  Bot,
  BookOpen,
  ShieldCheck,
  Zap,
  Menu,
  X,
  CircleDot,
  BarChart3,
  Clock,
  Cpu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import { api, formatRelativeTime } from '@/lib/api-client'
import { toast } from 'sonner'
import { DashboardView } from '@/components/platform/views/dashboard-view'
import { CatalogView } from '@/components/platform/views/catalog-view'
import { IntegrationsView } from '@/components/platform/views/integrations-view'
import { ApiKeysView } from '@/components/platform/views/api-keys-view'
import { LogsView } from '@/components/platform/views/logs-view'
import { PlaygroundView } from '@/components/platform/views/playground-view'
import { DocsView } from '@/components/platform/views/docs-view'
import { AuditView } from '@/components/platform/views/audit-view'
import { UsageView } from '@/components/platform/views/usage-view'
import { SchedulesView } from '@/components/platform/views/schedules-view'
import { AiModelsView } from '@/components/platform/views/ai-models-view'
import { ScheduleTicker } from '@/components/platform/schedule-ticker'

type ViewId =
  | 'dashboard'
  | 'catalog'
  | 'integrations'
  | 'keys'
  | 'logs'
  | 'playground'
  | 'aimodels'
  | 'schedules'
  | 'usage'
  | 'audit'
  | 'docs'

interface NavItem {
  id: ViewId
  label: string
  icon: typeof LayoutDashboard
  description: string
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & metrics' },
  { id: 'catalog', label: 'Tool Catalog', icon: Wrench, description: 'Pre-built agent tools' },
  { id: 'integrations', label: 'Connected Apps', icon: Plug, description: 'Credentials & OAuth' },
  { id: 'keys', label: 'API Keys', icon: KeyRound, description: 'Programmatic access' },
  { id: 'logs', label: 'Execution Logs', icon: Activity, description: 'Live & historical' },
  { id: 'playground', label: 'AI Playground', icon: Bot, description: 'Test tools via agent' },
  { id: 'aimodels', label: 'AI Models', icon: Cpu, description: 'Connect any AI provider' },
  { id: 'schedules', label: 'Schedules', icon: Clock, description: 'Automated tool runs' },
  { id: 'usage', label: 'Usage Analytics', icon: BarChart3, description: 'Insights & trends' },
  { id: 'audit', label: 'Audit Trail', icon: ShieldCheck, description: 'Security events' },
  { id: 'docs', label: 'API Docs', icon: BookOpen, description: 'Quickstart & SDK' },
]

export default function Home() {
  const [view, setView] = useState<ViewId>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [lastEventTs, setLastEventTs] = useState<number | null>(null)

  // One-time catalog seed on first load (idempotent)
  const ensureSeeded = useCallback(async () => {
    try {
      await api('/api/seed', { method: 'POST' })
    } catch {
      /* ignore */
    } finally {
      setBootstrapped(true)
    }
  }, [])

  useEffect(() => {
    void ensureSeeded()
  }, [ensureSeeded])

  const currentNav = NAV.find((n) => n.id === view)!

  const NavList = ({ onPick }: { onPick?: () => void }) => (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {NAV.map((item) => {
        const Icon = item.icon
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => {
              setView(item.id)
              onPick?.()
            }}
            className={cn(
              'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
              />
            )}
            <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', active && 'text-primary')} />
            <span className="flex-1">{item.label}</span>
            {active && <CircleDot className="h-3 w-3 opacity-70" />}
          </button>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex h-14 items-center gap-2 border-b px-4">
              <BrandMark />
              <button onClick={() => setMobileOpen(false)} className="ml-auto" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList onPick={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <BrandMark />
        <div className="ml-1 hidden sm:block">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight">{currentNav.label}</h1>
            <Badge variant="outline" className="hidden lg:inline-flex text-[10px] font-normal text-muted-foreground">
              {currentNav.description}
            </Badge>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {lastEventTs && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              live · {formatRelativeTime(lastEventTs)}
            </span>
          )}
          <a
            href="https://chat.z.ai"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex"
          >
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" /> Production
            </Badge>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-card/30">
          <div className="flex-1 overflow-y-auto">
            <NavList />
          </div>
          <div className="border-t p-3">
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 to-primary/5 p-3 text-xs text-muted-foreground dark:from-primary/10 dark:to-primary/10">
              <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-2xl dark:bg-primary/10" aria-hidden />
              <div className="relative flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" /> Secure by default
              </div>
              <p className="relative mt-1 leading-snug">
                Credentials encrypted at rest. API keys SHA-256 hashed. Rate-limited per key.
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden">
          {!bootstrapped ? (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                <p className="text-sm">Initialising workspace…</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
              {view === 'dashboard' && <DashboardView onNavigate={setView} onLiveEvent={(ts) => setLastEventTs(ts)} />}
              {view === 'catalog' && <CatalogView />}
              {view === 'integrations' && <IntegrationsView />}
              {view === 'keys' && <ApiKeysView />}
              {view === 'logs' && <LogsView onLiveEvent={(ts) => setLastEventTs(ts)} />}
              {view === 'playground' && <PlaygroundView />}
              {view === 'aimodels' && <AiModelsView />}
              {view === 'schedules' && <SchedulesView />}
              {view === 'usage' && <UsageView />}
              {view === 'audit' && <AuditView />}
              {view === 'docs' && <DocsView />}
            </div>
          )}
        </main>
      </div>

      <footer className="mt-auto border-t bg-gradient-to-b from-transparent to-muted/30 px-4 py-4 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.04)] md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>AgentForge · Unified AI-Native API Layer</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            All systems operational
          </p>
        </div>
      </footer>

      {/* Background schedule ticker — processes due schedules every 60s */}
      <ScheduleTicker />
    </div>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Zap className="h-4 w-4" fill="currentColor" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight">AgentForge</div>
        <div className="hidden text-[10px] text-muted-foreground sm:block">AI-Native API Layer</div>
      </div>
    </div>
  )
}
