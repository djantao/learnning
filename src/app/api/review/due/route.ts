import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dueCards = await prisma.flashcard.findMany({
    where: {
      userId: session.user.id,
      isSuspended: false,
      sm2NextReview: { lte: new Date() },
    },
    orderBy: { sm2Efactor: "asc" }, // hardest first
    take: 50,
  })

  return NextResponse.json({ cards: dueCards, count: dueCards.length })
}
