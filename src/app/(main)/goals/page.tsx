import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { GoalTree } from "@/components/goals/goal-tree"

export default async function GoalsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const goals = await prisma.learningGoal.findMany({
    where: { userId: session.user.id, parentGoalId: null },
    include: {
      childGoals: {
        include: {
          childGoals: true,
          materials: {
            include: { page: { select: { id: true, title: true, slug: true } } },
          },
        },
      },
      materials: {
        include: { page: { select: { id: true, title: true, slug: true } } },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  const pages = await prisma.page.findMany({
    where: { userId: session.user.id, isArchived: false },
    select: { id: true, title: true, slug: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  })

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  })

  return <GoalTree initialGoals={JSON.parse(JSON.stringify(goals))} availablePages={JSON.parse(JSON.stringify(pages))} courses={JSON.parse(JSON.stringify(courses))} />
}
