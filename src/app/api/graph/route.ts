import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notes = await prisma.page.findMany({
    where: { userId: session.user.id, isArchived: false },
    select: {
      id: true,
      title: true,
      slug: true,
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  })

  const links = await prisma.noteLink.findMany({
    where: {
      sourcePage: { userId: session.user.id },
      targetPage: { userId: session.user.id },
    },
    select: {
      sourcePageId: true,
      targetPageId: true,
      linkText: true,
    },
  })

  // Only keep links where both endpoints are in the fetched notes
  const noteIds = new Set(notes.map((n) => n.id))
  const filteredLinks = links.filter((l) => noteIds.has(l.sourcePageId) && noteIds.has(l.targetPageId))

  return NextResponse.json({
    nodes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      slug: n.slug,
      tags: n.tags.map((t) => t.tag),
    })),
    edges: filteredLinks.map((l) => ({
      source: l.sourcePageId,
      target: l.targetPageId,
      label: l.linkText,
    })),
  })
}
