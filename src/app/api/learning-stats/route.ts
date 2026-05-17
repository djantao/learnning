import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const kps = await prisma.knowledgePoint.findMany({
    where: {
      module: { course: { userId: session.user.id } },
      firstOpenedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      firstOpenedAt: true,
      mastery: true,
      practiceRecords: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  })

  const details = kps.map((kp) => {
    const firstEval = kp.practiceRecords[0]?.createdAt ?? null
    const firstOpened = kp.firstOpenedAt!
    const durationMinutes = firstEval
      ? Math.round((firstEval.getTime() - firstOpened.getTime()) / 60000)
      : null

    return {
      kpId: kp.id,
      kpTitle: kp.title,
      firstOpenedAt: firstOpened.toISOString(),
      firstEvaluatedAt: firstEval?.toISOString() ?? null,
      durationMinutes,
      mastery: kp.mastery,
    }
  })

  const withDuration = details.filter((d) => d.durationMinutes !== null)
  const totalMinutes = withDuration.reduce((sum, d) => sum + (d.durationMinutes ?? 0), 0)
  const avgMinutes = withDuration.length > 0 ? Math.round(totalMinutes / withDuration.length) : 0

  return NextResponse.json({
    totalKpsOpened: kps.length,
    totalKpsEvaluated: withDuration.length,
    totalLearningMinutes: totalMinutes,
    avgLearningMinutes: avgMinutes,
    details,
  })
}
