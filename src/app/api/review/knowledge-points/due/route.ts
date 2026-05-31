import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()

  const dueKps = await prisma.knowledgePoint.findMany({
    where: {
      module: { course: { userId: session.user.id } },
      mastery: { gte: 4 },
      sm2NextReview: { lte: now },
    },
    select: {
      id: true, title: true, content: true, mastery: true,
      sm2Interval: true, sm2Repetitions: true, sm2Efactor: true,
      sm2NextReview: true, lastReviewedAt: true,
      module: { select: { id: true, title: true, course: { select: { id: true, title: true, icon: true, color: true } } } },
    },
    orderBy: { sm2NextReview: "asc" },
    take: 20,
  })

  return NextResponse.json(dueKps)
}
