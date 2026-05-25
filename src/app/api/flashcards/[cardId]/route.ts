import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const body = await req.json()
  const { front, back, isSuspended } = body

  const existing = await prisma.flashcard.findFirst({
    where: { id: cardId, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const card = await prisma.flashcard.update({
    where: { id: cardId },
    data: {
      ...(front !== undefined && { front }),
      ...(back !== undefined && { back }),
      ...(isSuspended !== undefined && { isSuspended }),
    },
  })

  return NextResponse.json(card)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  await prisma.flashcard.deleteMany({ where: { id: cardId, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
