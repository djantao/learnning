import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessions = await prisma.reviewSession.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return NextResponse.json(sessions)
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const newSession = await prisma.reviewSession.create({
    data: { userId: session.user.id },
  })

  return NextResponse.json(newSession, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { sessionId, gradesDistribution, totalTimeSeconds } = body as {
    sessionId: string
    gradesDistribution?: string
    totalTimeSeconds?: number
  }

  const existing = await prisma.reviewSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Compute average grade from distribution
  let avgGrade: number | undefined
  if (gradesDistribution) {
    const dist: Record<string, number> = JSON.parse(gradesDistribution)
    let totalCards = 0
    let sumGrades = 0
    for (const [grade, count] of Object.entries(dist)) {
      totalCards += count
      sumGrades += Number(grade) * count
    }
    avgGrade = totalCards > 0 ? sumGrades / totalCards : undefined
  }

  const updated = await prisma.reviewSession.update({
    where: { id: sessionId },
    data: {
      endedAt: new Date(),
      ...(gradesDistribution && { gradesDistribution }),
      ...(avgGrade !== undefined && { avgGrade }),
      ...(totalTimeSeconds && { totalTimeSeconds }),
    },
  })

  return NextResponse.json(updated)
}
