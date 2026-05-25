import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NotebookList } from "@/components/notes/notebook-list"

export default async function NotebooksPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const notebooks = await prisma.notebook.findMany({
    where: { userId: session.user.id },
    include: {
      sections: {
        include: {
          pages: {
            select: { id: true, title: true, slug: true, updatedAt: true, excerpt: true },
            where: { isArchived: false },
            orderBy: { updatedAt: "desc" },
            take: 10,
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return <NotebookList initialNotebooks={JSON.parse(JSON.stringify(notebooks))} />
}
