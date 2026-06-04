import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const focus = searchParams.get("focus") // "weak" | null
  const cram = searchParams.get("cram") === "true"
  const take = Math.min(parseInt(searchParams.get("take") || "20"), 50)
  const now = new Date()

  const baseWhere = {
    module: { course: { userId: session.user.id } },
  }

  let where: Record<string, unknown> = { ...baseWhere }

  if (focus === "weak") {
    where = { ...baseWhere, mastery: { gt: 0, lt: 4 }, sm2Repetitions: { gt: 0 } }
  } else if (cram) {
    where = { ...baseWhere, mastery: { gte: 4 } }
  } else {
    where = { ...baseWhere, mastery: { gte: 4 }, sm2NextReview: { lte: now } }
  }

  const dueKps = await prisma.knowledgePoint.findMany({
    where,
    select: {
      id: true, title: true, content: true, mastery: true,
      sm2Interval: true, sm2Repetitions: true, sm2Efactor: true,
      sm2NextReview: true, lastReviewedAt: true,
      module: { select: { id: true, title: true, course: { select: { id: true, title: true, icon: true, color: true } } } },
    },
    orderBy: cram
      ? [{ mastery: "asc" }, { sm2NextReview: "asc" } as const]
      : focus === "weak"
        ? [{ mastery: "asc" }, { sm2Repetitions: "desc" } as const]
        : { sm2NextReview: "asc" } as const,
    take,
  })

  return NextResponse.json(dueKps)
}
