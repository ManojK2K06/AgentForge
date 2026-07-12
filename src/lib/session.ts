import { db } from './db'

// Single-tenant operator session.
// The platform is operated by a single workspace owner. On first run we
// bootstrap an operator user. API keys & integrations are scoped to this user.
// For multi-tenant SaaS, swap this for NextAuth sessions.

const OPERATOR_EMAIL = 'operator@agentforge.local'

/**
 * Get or create the platform operator user. Idempotent.
 */
export async function getOperator() {
  let user = await db.user.findUnique({ where: { email: OPERATOR_EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: OPERATOR_EMAIL,
        name: 'Workspace Operator',
      },
    })
  }
  return user
}

export async function getOperatorId(): Promise<string> {
  const u = await getOperator()
  return u.id
}
