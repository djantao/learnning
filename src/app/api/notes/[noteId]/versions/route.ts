import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

// GET /api/notes/[noteId]/versions — list all versions for a note
export async function GET(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId } = await params

  // Verify note ownership
  const page = await prisma.page.findFirst({
    where: { id: noteId, userId: session.user.id },
    select: { id: true },
  })
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const versions = await prisma.noteVersion.findMany({
    where: { pageId: noteId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      title: true,
      wordCount: true,
      changeSummary: true,
      createdAt: true,
    },
  })

  return NextResponse.json(versions)
}

// POST /api/notes/[noteId]/versions — restore a version to current
export async function POST(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId } = await params
  const body = await req.json()
  const { versionId } = body

  if (!versionId) return NextResponse.json({ error: "versionId required" }, { status: 400 })

  // Verify note ownership
  const page = await prisma.page.findFirst({
    where: { id: noteId, userId: session.user.id },
    select: { id: true },
  })
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Fetch the version to restore
  const version = await prisma.noteVersion.findFirst({
    where: { id: versionId, pageId: noteId },
  })
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 })

  // Restore the content without creating a new version
  const updated = await prisma.page.update({
    where: { id: noteId },
    data: {
      title: version.title,
      content: version.content,
      contentPlain: version.contentPlain,
      wordCount: version.wordCount,
    },
  })

  return NextResponse.json({ success: true, page: updated })
}
