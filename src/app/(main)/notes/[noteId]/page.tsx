import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { NoteEditor } from "@/components/editor/note-editor"

export default async function NotePage({ params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { noteId } = await params

  const [note, notebooks] = await Promise.all([
    prisma.page.findFirst({
      where: { id: noteId, userId: session.user.id },
      include: {
        tags: { include: { tag: true } },
        section: { select: { id: true, name: true, notebookId: true } },
        linksFrom: { include: { targetPage: { select: { id: true, title: true, slug: true } } }, take: 20 },
        linksTo: { include: { sourcePage: { select: { id: true, title: true, slug: true } } }, take: 20 },
      },
    }),
    prisma.notebook.findMany({
      where: { userId: session.user.id },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  if (!note) notFound()

  return (
    <div className="space-y-4">
      <NoteEditor notebooks={notebooks} initialNote={note} />
    </div>
  )
}
