import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()

  const [dueCount, totalInRotation, recentLogs] = await Promise.all([
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, mastery: { gte: 4 }, sm2NextReview: { lte: now } },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, sm2Repetitions: { gt: 0 } },
    }),
    prisma.kpReviewLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { grade: true, createdAt: true },
    }),
  ])

  const avgGrade = recentLogs.length > 0
    ? Math.round((recentLogs.reduce((s, l) => s + l.grade, 0) / recentLogs.length) * 10) / 10
    : null

  return NextResponse.json({
    dueCount, totalInRotation, avgGrade,
    recentLogs: recentLogs.map((l) => ({ grade: l.grade, date: l.createdAt.toISOString().split("T")[0] })),
  })
}
