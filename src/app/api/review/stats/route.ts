import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [totalCards, dueCards, mastered, recentSessions] = await Promise.all([
    prisma.flashcard.count({ where: { userId: session.user.id, isSuspended: false } }),
    prisma.flashcard.count({
      where: { userId: session.user.id, isSuspended: false, sm2NextReview: { lte: new Date() } },
    }),
    prisma.flashcard.count({
      where: { userId: session.user.id, isSuspended: false, sm2Interval: { gte: 21 } },
    }),
    prisma.reviewSession.findMany({
      where: { userId: session.user.id },
      orderBy: { startedAt: "desc" },
      take: 7,
    }),
  ])

  return NextResponse.json({ totalCards, dueCards, mastered, recentSessions })
}
