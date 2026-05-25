import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cards = await prisma.flashcard.findMany({
    where: { userId: session.user.id },
    include: {
      page: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  })

  return NextResponse.json(cards)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { front, back, pageId, tagsJson } = body

  const card = await prisma.flashcard.create({
    data: {
      userId: session.user.id,
      front: front || "",
      back: back || "",
      pageId: pageId || null,
      tagsJson: tagsJson || "[]",
      sourceType: "manual",
      sm2NextReview: new Date(),
    },
  })

  return NextResponse.json(card, { status: 201 })
}
