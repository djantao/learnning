import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { trackActivity } from "@/lib/activity"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sectionId = searchParams.get("sectionId")
  const search = searchParams.get("search")
  const tag = searchParams.get("tag")
  const knowledgePointId = searchParams.get("knowledgePointId")

  const where: Record<string, unknown> = { userId: session.user.id, isArchived: false }
  if (sectionId) where.sectionId = sectionId
  if (knowledgePointId) where.knowledgePointId = knowledgePointId
  if (tag) {
    where.tags = { some: { tag: { name: tag, userId: session.user.id } } }
  }
  if (search) {
    where.contentPlain = { contains: search }
  }

  const pages = await prisma.page.findMany({
    where: where as any,
    include: {
      tags: { include: { tag: true } },
      section: { select: { id: true, name: true, notebookId: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  })

  return NextResponse.json(pages)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { title, content, sectionId, knowledgePointId, tags: tagNames } = body

  // Generate slug from title
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-|-$/g, "")
  const slug = base + "-" + Date.now().toString(36)

  // Extract plain text (strip markdown)
  const contentPlain = content
    .replace(/[#*`\[\]()>!|~=\-_{}.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const excerpt = contentPlain.slice(0, 200)
  const wordCount = contentPlain.split(/\s+/).filter(Boolean).length

  // Parse wikilinks
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
  const wikiLinks: string[] = []
  let m
  while ((m = wikiLinkRegex.exec(content)) !== null) {
    wikiLinks.push(m[1])
  }

  // Create page and related records
  const page = await prisma.page.create({
    data: {
      userId: session.user.id,
      title,
      slug,
      content,
      contentPlain,
      excerpt,
      wordCount,
      sectionId: sectionId || null,
      knowledgePointId: knowledgePointId || null,
    },
  })

  // Create tags
  if (tagNames?.length > 0) {
    for (const name of tagNames) {
      let tag = await prisma.tag.findUnique({
        where: { userId_name: { userId: session.user.id, name } },
      })
      if (!tag) {
        tag = await prisma.tag.create({ data: { userId: session.user.id, name } })
      }
      await prisma.pageTag.create({ data: { pageId: page.id, tagId: tag.id } })
    }
  }

  // Create wiki links
  for (const linkText of wikiLinks) {
    const target = await prisma.page.findFirst({
      where: { userId: session.user.id, title: { contains: linkText } },
    })
    if (target && target.id !== page.id) {
      await prisma.noteLink.create({
        data: { sourcePageId: page.id, targetPageId: target.id, linkText },
      }).catch(() => {}) // ignore duplicate link errors
    }
  }

  trackActivity(session.user.id, { notesCreated: 1 }).catch(() => {})

  return NextResponse.json(page, { status: 201 })
}
