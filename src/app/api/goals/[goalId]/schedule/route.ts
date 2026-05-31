import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getDailyRequirement, scheduleFromGoal } from "@/lib/schedule"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await prisma.learningGoal.findUnique({
    where: { id: goalId },
    select: { userId: true, courseId: true },
  })
  if (!goal || goal.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const requirement = await getDailyRequirement(goalId)
  return NextResponse.json(requirement)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await prisma.learningGoal.findUnique({
    where: { id: goalId },
    select: { userId: true },
  })
  if (!goal || goal.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { targetDate } = await req.json()
  if (!targetDate) {
    return NextResponse.json({ error: "targetDate required" }, { status: 400 })
  }

  const result = await scheduleFromGoal(session.user.id, goalId, new Date(targetDate))
  return NextResponse.json(result)
}
