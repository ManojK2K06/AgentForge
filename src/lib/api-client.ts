'use client'

// Centralised fetcher for the dashboard. Auto-handles JSON + errors.
export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

export function formatRelativeTime(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date)
  const diff = Date.now() - d.getTime()
  if (diff < 5_000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString()
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function statusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'text-[#5C7A52] bg-[#5C7A52]/8 border-[#5C7A52]/20'
    case 'error':
      return 'text-[#A0533A] bg-[#A0533A]/8 border-[#A0533A]/20'
    case 'rate_limited':
      return 'text-[#8A6D3B] bg-[#8A6D3B]/8 border-[#8A6D3B]/20'
    case 'auth_failed':
      return 'text-[#A0533A] bg-[#A0533A]/8 border-[#A0533A]/20'
    case 'timeout':
      return 'text-[#6B5B4E] bg-[#6B5B4E]/8 border-[#6B5B4E]/20'
    default:
      return 'text-muted-foreground bg-muted border-border'
  }
}
