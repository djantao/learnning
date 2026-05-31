import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || "weekly"

  const now = new Date()
  const periodStart = new Date(now)
  if (type === "monthly") {
    periodStart.setDate(1)
  } else {
    const day = periodStart.getDay()
    periodStart.setDate(periodStart.getDate() + (day === 0 ? -6 : 1 - day))
  }
  periodStart.setHours(0, 0, 0, 0)
  const periodEnd = new Date(now)

  const [activities, kpsCompleted, practiceRecords] = await Promise.all([
    prisma.dailyActivity.findMany({
      where: { userId: session.user.id, date: { gte: periodStart, lte: periodEnd } },
      orderBy: { date: "asc" },
      select: { date: true, studyMinutes: true, kpsCompleted: true, cardsReviewed: true, notesCreated: true },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, completedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.practiceRecord.findMany({
      where: { userId: session.user.id, createdAt: { gte: periodStart, lte: periodEnd } },
      select: { aiScore: true },
    }),
  ])

  const totalStudyMinutes = activities.reduce((s, a) => s + a.studyMinutes, 0)
  const totalKpsCompleted = activities.reduce((s, a) => s + a.kpsCompleted, 0)
  const totalCardsReviewed = activities.reduce((s, a) => s + a.cardsReviewed, 0)
  const totalNotes = activities.reduce((s, a) => s + a.notesCreated, 0)
  const activeDays = activities.filter((a) => a.studyMinutes > 0).length
  const avgScore = practiceRecords.length > 0
    ? Math.round((practiceRecords.reduce((s, r) => s + (r.aiScore ?? 0), 0) / practiceRecords.length) * 10) / 10
    : null

  const dailyBreakdown = activities.map((a) => ({
    date: a.date.toISOString().split("T")[0],
    studyMinutes: a.studyMinutes, kpsCompleted: a.kpsCompleted, cardsReviewed: a.cardsReviewed,
  }))

  const suggestions: string[] = []
  if (activeDays < (type === "weekly" ? 3 : 10)) suggestions.push("学习频率偏低，建议每周至少学习 3 天以保持知识连贯性")
  if (totalStudyMinutes < (type === "weekly" ? 120 : 480)) suggestions.push("学习时长不足，建议每天至少投入 30 分钟")
  if (avgScore !== null && avgScore < 3) suggestions.push("练习题正确率偏低，建议先回顾知识点再做题")
  if (suggestions.length === 0) suggestions.push("继续保持当前的学习节奏！")

  return NextResponse.json({
    type, periodStart: periodStart.toISOString().split("T")[0], periodEnd: periodEnd.toISOString().split("T")[0],
    stats: { totalStudyMinutes, totalKpsCompleted, totalCardsReviewed, totalNotes, activeDays, avgScore },
    dailyBreakdown, suggestions,
  })
}
