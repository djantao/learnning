import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { trackActivity } from "@/lib/activity"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId } = await params

  const page = await prisma.page.findFirst({
    where: { id: noteId, userId: session.user.id },
    include: {
      tags: { include: { tag: true } },
      section: { select: { id: true, name: true, notebookId: true } },
      linksFrom: { include: { targetPage: { select: { id: true, title: true, slug: true } } } },
      linksTo: { include: { sourcePage: { select: { id: true, title: true, slug: true } } } },
    },
  })

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(page)
}

export async function PUT(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId } = await params
  const body = await req.json()
  const { title, content, sectionId, isPinned, isArchived, noteLayers, currentLayer } = body

  const existing = await prisma.page.findFirst({ where: { id: noteId, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const contentPlain = content
    ? content.replace(/[#*`\[\]()>!|~=\-_{}.]/g, " ").replace(/\s+/g, " ").trim()
    : existing.contentPlain
  const excerpt = contentPlain.slice(0, 200)
  const wordCount = contentPlain.split(/\s+/).filter(Boolean).length

  const page = await prisma.page.update({
    where: { id: noteId },
    data: {
      ...(title && { title }),
      ...(content !== undefined && { content, contentPlain, excerpt, wordCount }),
      ...(sectionId !== undefined && { sectionId }),
      ...(isPinned !== undefined && { isPinned }),
      ...(isArchived !== undefined && { isArchived }),
      ...(noteLayers !== undefined && { noteLayers }),
      ...(currentLayer !== undefined && { currentLayer }),
    },
  })

  // Re-parse wikilinks if content changed
  if (content !== undefined) {
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
    const wikiLinks: string[] = []
    let m
    while ((m = wikiLinkRegex.exec(content)) !== null) wikiLinks.push(m[1])

    for (const linkText of wikiLinks) {
      const target = await prisma.page.findFirst({
        where: { userId: session.user.id, title: { contains: linkText } },
      })
      if (target && target.id !== page.id) {
        await prisma.noteLink.upsert({
          where: { sourcePageId_targetPageId: { sourcePageId: page.id, targetPageId: target.id } },
          create: { sourcePageId: page.id, targetPageId: target.id, linkText },
          update: {},
        }).catch(() => {})
      }
    }

    trackActivity(session.user.id, { notesEdited: 1 }).catch(() => {})
  }

  return NextResponse.json(page)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId } = await params

  await prisma.page.deleteMany({ where: { id: noteId, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
