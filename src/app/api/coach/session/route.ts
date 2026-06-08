// 记录学习会话 + 学习方式统计

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { mode, courseId, kpId, duration = 0, rounds = 0 } = await req.json()
  if (!mode || !["traditional", "coach"].includes(mode)) {
    return NextResponse.json({ error: "mode 必须为 traditional 或 coach" }, { status: 400 })
  }

  const record = await prisma.learningSession.create({
    data: { userId: session.user.id, mode, courseId: courseId || null, kpId: kpId || null, duration, rounds },
  })

  return NextResponse.json({ id: record.id, mode: record.mode, createdAt: record.createdAt })
}

export async function GET() {
  const authSession = await auth()
  if (!authSession?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = authSession.user.id

  const [total, byMode, recentSessions] = await Promise.all([
    prisma.learningSession.count({ where: { userId } }),
    prisma.learningSession.groupBy({
      by: ["mode"], where: { userId },
      _count: { mode: true }, _sum: { rounds: true, duration: true },
    }),
    prisma.learningSession.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take: 20,
      include: { course: { select: { title: true } }, kp: { select: { title: true } } },
    }),
  ])

  const modeStats: Record<string, { count: number; totalRounds: number; totalMinutes: number }> = {}
  for (const m of byMode) {
    modeStats[m.mode] = {
      count: m._count.mode,
      totalRounds: m._sum.rounds ?? 0,
      totalMinutes: Math.round((m._sum.duration ?? 0) / 60),
    }
  }

  const tradCount = modeStats["traditional"]?.count ?? 0
  const coachCount = modeStats["coach"]?.count ?? 0
  const tradPct = total > 0 ? Math.round((tradCount / total) * 100) : 0
  const coachPct = total > 0 ? Math.round((coachCount / total) * 100) : 0

  return NextResponse.json({
    total,
    traditional: { ...(modeStats["traditional"] || { count: 0, totalRounds: 0, totalMinutes: 0 }), pct: tradPct },
    coach: { ...(modeStats["coach"] || { count: 0, totalRounds: 0, totalMinutes: 0 }), pct: coachPct },
    recentSessions: recentSessions.map((s) => ({
      id: s.id, mode: s.mode,
      courseTitle: s.course?.title, kpTitle: s.kp?.title,
      rounds: s.rounds, duration: Math.round(s.duration / 60),
      createdAt: s.createdAt.toISOString(),
    })),
  })
}
