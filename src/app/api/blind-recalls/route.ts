import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { knowledgePointId, userRecall, timeSpentSeconds } = (await req.json()) as { knowledgePointId: string; userRecall: string; timeSpentSeconds?: number }
  if (!knowledgePointId || !userRecall) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const recall = await prisma.blindRecall.create({
    data: { userId: session.user.id, knowledgePointId, userRecall, timeSpentSeconds },
  })
  return NextResponse.json({ id: recall.id })
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const kpId = new URL(req.url).searchParams.get("kpId")

  const recalls = await prisma.blindRecall.findMany({
    where: { userId: session.user.id, ...(kpId ? { knowledgePointId: kpId } : {}) },
    orderBy: { createdAt: "desc" }, take: kpId ? 20 : 5,
    select: { id: true, knowledgePointId: true, recallScore: true, timeSpentSeconds: true, createdAt: true },
  })
  return NextResponse.json(recalls)
}
