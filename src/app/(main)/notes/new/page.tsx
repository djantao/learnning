import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { NoteEditor } from "@/components/editor/note-editor"

export default async function NewNotePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const notebooks = await prisma.notebook.findMany({
    where: { userId: session.user.id },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  })

  return (
    <div className="space-y-4">
      <NoteEditor notebooks={notebooks} />
    </div>
  )
}
