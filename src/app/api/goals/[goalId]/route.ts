import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { computeGoalProgress, recomputeGoalTree } from "@/lib/goals"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params

  const goal = await prisma.learningGoal.findFirst({
    where: { id: goalId, userId: session.user.id },
    include: {
      childGoals: true,
      materials: {
        include: { page: { select: { id: true, title: true, slug: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Compute live progress from flashcard data
  const liveProgress = await computeGoalProgress(goalId)

  return NextResponse.json({ ...goal, progressPct: liveProgress })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const body = await req.json()

  const goal = await prisma.learningGoal.updateMany({
    where: { id: goalId, userId: session.user.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.progressPct !== undefined && { progressPct: body.progressPct }),
      ...(body.parentGoalId !== undefined && { parentGoalId: body.parentGoalId }),
      ...(body.courseId !== undefined && { courseId: body.courseId }),
      ...(body.completedAt !== undefined && { completedAt: body.completedAt }),
    },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  await prisma.learningGoal.deleteMany({ where: { id: goalId, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
