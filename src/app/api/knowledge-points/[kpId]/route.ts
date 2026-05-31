import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recomputeForKnowledgePoint } from "@/lib/curriculum"
import { trackActivity } from "@/lib/activity"
import { NextResponse } from "next/server"

async function verifyOwnership(kpId: string, userId: string) {
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: kpId },
    include: { module: { include: { course: { select: { userId: true } } } } },
  })
  return kp?.module.course.userId === userId ? kp : null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kpId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { kpId } = await params
  const owner = await verifyOwnership(kpId, session.user.id)
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const full = await prisma.knowledgePoint.findUnique({
    where: { id: kpId },
    include: { module: { select: { id: true, title: true, courseId: true, sortOrder: true } } },
  })

  const siblings = await prisma.knowledgePoint.findMany({
    where: { moduleId: full!.moduleId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, sortOrder: true },
  })
  const idx = siblings.findIndex((s) => s.id === kpId)

  return NextResponse.json({
    ...full,
    prev: idx > 0 ? siblings[idx - 1] : null,
    next: idx < siblings.length - 1 ? siblings[idx + 1] : null,
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ kpId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { kpId } = await params
  const owner = await verifyOwnership(kpId, session.user.id)
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()

  // Only set firstOpenedAt once — never overwrite
  if (body.firstOpenedAt && owner.firstOpenedAt) {
    delete body.firstOpenedAt
  }

  // Only set completedAt once — never overwrite
  if (body.completedAt && owner.completedAt) {
    delete body.completedAt
  }

  const kp = await prisma.knowledgePoint.update({ where: { id: kpId }, data: body })

  if (body.mastery !== undefined) {
    recomputeForKnowledgePoint(kpId).catch(() => {})
    if (body.mastery >= 4) {
      trackActivity(session.user.id, { kpsCompleted: 1, studyMinutes: 5 }).catch(() => {})
      // Initialize SM-2 for first-time mastery
      if (!owner.sm2NextReview) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        prisma.knowledgePoint.update({
          where: { id: kpId },
          data: { sm2NextReview: tomorrow, sm2Interval: 1 },
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json(kp)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ kpId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { kpId } = await params
  const owner = await verifyOwnership(kpId, session.user.id)
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.knowledgePoint.delete({ where: { id: kpId } })
  return NextResponse.json({ success: true })
}
