import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaSchemaVersion?: string
}

// Schema version — bump this after adding/removing Prisma models to force
// the dev server to create a fresh PrismaClient (hot reload doesn't pick up
// generated client changes automatically).
const CURRENT_VERSION = 'v3-schedule'

// If the schema version changed, discard the old cached client.
if (globalForPrisma.__prismaSchemaVersion !== CURRENT_VERSION) {
  if (globalForPrisma.prisma) {
    try { globalForPrisma.prisma.$disconnect() } catch {}
  }
  globalForPrisma.prisma = undefined
  globalForPrisma.__prismaSchemaVersion = CURRENT_VERSION
}

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error', 'warn'] })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}