import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 未来7天的复习负载预测
  const forecast: { date: string; count: number }[] = []
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(today)
    dayStart.setDate(dayStart.getDate() + i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const count = await prisma.knowledgePoint.count({
      where: {
        module: { course: { userId: session.user.id } },
        mastery: { gte: 4 },
        sm2NextReview: { gte: dayStart, lt: dayEnd },
      },
    })
    forecast.push({ date: dayStart.toISOString().split("T")[0], count })
  }

  // 今日统计
  const [todayDue, todayDone, overdueCount] = await Promise.all([
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, mastery: { gte: 4 }, sm2NextReview: { lte: today } },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, mastery: { gte: 4 }, lastReviewedAt: { gte: today } },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, mastery: { gte: 4 }, sm2NextReview: { lt: today } },
    }),
  ])

  // 最近7天复习趋势
  const trend: { date: string; reviewed: number; avgGrade: number | null }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dStart = new Date(d)
    const dEnd = new Date(d)
    dEnd.setDate(dEnd.getDate() + 1)

    const logs = await prisma.kpReviewLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: dStart, lt: dEnd } },
      select: { grade: true },
    })
    trend.push({
      date: dStart.toISOString().split("T")[0],
      reviewed: logs.length,
      avgGrade: logs.length > 0
        ? Math.round((logs.reduce((s, l) => s + l.grade, 0) / logs.length) * 10) / 10
        : null,
    })
  }

  const weekTotal = forecast.reduce((s, f) => s + f.count, 0)
  const maxDay = forecast.reduce((max, f) => f.count > max.count ? f : max, forecast[0])

  return NextResponse.json({
    today: { due: todayDue, done: todayDone, overdue: overdueCount },
    weekTotal,
    maxDay: maxDay ? { date: maxDay.date, count: maxDay.count } : null,
    forecast,
    trend,
  })
}
