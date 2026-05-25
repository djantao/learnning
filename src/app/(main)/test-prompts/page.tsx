import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PromptTester } from "./prompt-tester"

export default async function TestPromptsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    select: {
      id: true, title: true,
      modules: {
        where: { parentModuleId: null },
        select: {
          id: true, title: true,
          knowledgePoints: { select: { id: true, title: true }, orderBy: { sortOrder: "asc" } },
          childModules: {
            select: {
              id: true, title: true,
              knowledgePoints: { select: { id: true, title: true }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return <PromptTester courses={JSON.parse(JSON.stringify(courses))} />
}
