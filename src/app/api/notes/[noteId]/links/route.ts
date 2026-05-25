import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId } = await params

  const [forward, back] = await Promise.all([
    prisma.noteLink.findMany({
      where: { sourcePageId: noteId },
      include: { targetPage: { select: { id: true, title: true, slug: true, excerpt: true } } },
    }),
    prisma.noteLink.findMany({
      where: { targetPageId: noteId },
      include: { sourcePage: { select: { id: true, title: true, slug: true, excerpt: true } } },
    }),
  ])

  return NextResponse.json({ forward, backlinks: back })
}
