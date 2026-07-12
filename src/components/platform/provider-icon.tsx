'use client'

import {
  Slack,
  Github,
  Database,
  Mail,
  Globe,
  Webhook,
  Sparkles,
  Cloud,
  Wrench,
  FileText,
  MessageCircle,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  slack: Slack,
  github: Github,
  database: Database,
  mail: Mail,
  globe: Globe,
  webhook: Webhook,
  sparkles: Sparkles,
  cloud: Cloud,
  wrench: Wrench,
  'file-text': FileText,
  'message-circle': MessageCircle,
  'git-branch': GitBranch,
}

// Minimalist palette — all icons use warm brown/taupe tones
// instead of colorful per-provider branding. Consistent & understated.
const COLORS: Record<string, string> = {
  slack: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  github: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  database: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  mail: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  globe: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  webhook: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  sparkles: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  cloud: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  'file-text': 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  'message-circle': 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  'git-branch': 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
  wrench: 'bg-[#3D2B1F]/8 text-[#3D2B1F] dark:bg-[#E8E0D5]/10 dark:text-[#E8E0D5]',
}

export function ProviderIcon({
  iconKey,
  size = 16,
  className,
}: {
  iconKey: string
  size?: number
  className?: string
}) {
  const Icon = MAP[iconKey] ?? Wrench
  const color = COLORS[iconKey] ?? COLORS.wrench
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${color} ${className ?? ''}`}
      aria-hidden
    >
      <Icon style={{ width: size, height: size }} strokeWidth={1.5} />
    </span>
  )
}

export function providerLabel(iconKey: string): string {
  const m: Record<string, string> = {
    slack: 'Slack',
    github: 'GitHub',
    database: 'PostgreSQL',
    mail: 'SMTP',
    globe: 'HTTP',
    webhook: 'Webhook',
    sparkles: 'LLM',
    cloud: 'Salesforce',
    'file-text': 'Notion',
    'message-circle': 'Twilio',
    'git-branch': 'Linear',
    wrench: 'Tool',
  }
  return m[iconKey] ?? iconKey
}
