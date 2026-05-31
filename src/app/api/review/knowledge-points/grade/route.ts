import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sm2, type Grade } from "@/lib/sm2"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { kpId, grade } = await req.json()
  if (!kpId || grade === undefined) {
    return NextResponse.json({ error: "kpId and grade required" }, { status: 400 })
  }

  const g = grade as Grade
  if (g < 0 || g > 5) {
    return NextResponse.json({ error: "grade must be 0-5" }, { status: 400 })
  }

  const kp = await prisma.knowledgePoint.findFirst({
    where: { id: kpId, module: { course: { userId: session.user.id } } },
    select: { id: true, sm2Interval: true, sm2Repetitions: true, sm2Efactor: true, sm2NextReview: true },
  })

  if (!kp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const now = new Date()
  const beforeState = {
    interval: kp.sm2Interval,
    repetitions: kp.sm2Repetitions,
    efactor: kp.sm2Efactor,
    nextReview: kp.sm2NextReview ?? now,
  }

  const newState = sm2(beforeState, g, now)

  const [updatedKp] = await Promise.all([
    prisma.knowledgePoint.update({
      where: { id: kpId },
      data: {
        sm2Interval: newState.interval,
        sm2Repetitions: newState.repetitions,
        sm2Efactor: newState.efactor,
        sm2NextReview: newState.nextReview,
        lastReviewedAt: now,
      },
      select: { id: true, sm2Interval: true, sm2Repetitions: true, sm2Efactor: true, sm2NextReview: true, lastReviewedAt: true },
    }),
    prisma.kpReviewLog.create({
      data: {
        userId: session.user.id,
        knowledgePointId: kpId,
        grade: g,
        intervalBefore: beforeState.interval,
        intervalAfter: newState.interval,
        efactorBefore: beforeState.efactor,
        efactorAfter: newState.efactor,
      },
    }),
  ])

  return NextResponse.json({ ...updatedKp, nextReviewDate: newState.nextReview.toISOString() })
}
