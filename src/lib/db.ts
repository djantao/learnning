import { PrismaClient } from "@/generated/prisma/client"
import { PrismaNeonHttp } from "@prisma/adapter-neon"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function getPrismaClient() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error("DATABASE_URL is required")

  const adapter = new PrismaNeonHttp(dbUrl, {})
  const client = new PrismaClient({ adapter })

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client
  }

  return client
}

export const prisma = getPrismaClient()
