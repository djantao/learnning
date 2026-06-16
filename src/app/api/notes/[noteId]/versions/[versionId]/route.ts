import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

// GET /api/notes/[noteId]/versions/[versionId] — get single version detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ noteId: string; versionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { noteId, versionId } = await params

  // Verify note ownership
  const page = await prisma.page.findFirst({
    where: { id: noteId, userId: session.user.id },
    select: { id: true },
  })
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const version = await prisma.noteVersion.findFirst({
    where: { id: versionId, pageId: noteId },
  })
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 })

  return NextResponse.json(version)
}
