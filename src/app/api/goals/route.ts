import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const goals = await prisma.learningGoal.findMany({
    where: { userId: session.user.id },
    include: {
      childGoals: { include: { childGoals: true } },
      materials: {
        include: { page: { select: { id: true, title: true, slug: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(goals)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { title, description, parentGoalId, targetDate, courseId } = body

  const goal = await prisma.learningGoal.create({
    data: {
      userId: session.user.id,
      title,
      description: description || "",
      parentGoalId: parentGoalId || null,
      targetDate: targetDate ? new Date(targetDate) : null,
      courseId: courseId || null,
    },
  })

  return NextResponse.json(goal, { status: 201 })
}
