import { db } from './db'

export interface AuditInput {
  action: string
  actorType?: 'user' | 'system' | 'api_key'
  actorId?: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userId?: string | null
}

/**
 * Write an audit log entry. Never throws — failures are swallowed
 * because audit logging must not break the request flow.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        actorType: input.actorType ?? 'system',
        actorId: input.actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: JSON.stringify(input.metadata ?? {}),
        ipAddress: input.ipAddress ?? null,
        userId: input.userId ?? null,
      },
    })
  } catch (e) {
    // swallow; audit must never break request
    console.error('[audit] failed to write log:', e)
  }
}

/**
 * Get the "best" client IP from a Next.js Request, respecting X-Forwarded-For.
 */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri.trim()
  return null
}
