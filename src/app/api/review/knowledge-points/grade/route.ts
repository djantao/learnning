import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sm2, type Grade } from "@/lib/sm2"
import { recomputeForKnowledgePoint } from "@/lib/curriculum"
import { trackActivity } from "@/lib/activity"
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

  const kpCurrent = await prisma.knowledgePoint.findUnique({
    where: { id: kpId },
    select: { mastery: true, status: true, completedAt: true },
  })

  let newMastery = kpCurrent?.mastery ?? 0
  if (g >= 4) {
    // 复习答得好 → 小幅提升 mastery
    newMastery = Math.min(5, newMastery + 1)
  } else if (g <= 2) {
    // 复习答错 → 降低 mastery，标记为需要重新学习
    newMastery = Math.max(0, newMastery - 1)
  }

  const masteryChanged = newMastery !== (kpCurrent?.mastery ?? 0)

  const [updatedKp] = await Promise.all([
    prisma.knowledgePoint.update({
      where: { id: kpId },
      data: {
        sm2Interval: newState.interval,
        sm2Repetitions: newState.repetitions,
        sm2Efactor: newState.efactor,
        sm2NextReview: newState.nextReview,
        lastReviewedAt: now,
        ...(masteryChanged
          ? {
              mastery: newMastery,
              status: newMastery >= 4 ? "mastered" : newMastery > 0 ? "in_progress" : "not_started",
              completedAt: newMastery >= 4 && !kpCurrent?.completedAt ? new Date() : undefined,
            }
          : {}),
      },
      select: { id: true, sm2Interval: true, sm2Repetitions: true, sm2Efactor: true, sm2NextReview: true, lastReviewedAt: true, mastery: true, status: true },
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

  if (masteryChanged) {
    recomputeForKnowledgePoint(kpId).catch(() => {})
    if (newMastery >= 4) {
      trackActivity(session.user.id, { kpsCompleted: 1, studyMinutes: 5 }).catch(() => {})
    }
  }

  return NextResponse.json({ ...updatedKp, nextReviewDate: newState.nextReview.toISOString() })
}
