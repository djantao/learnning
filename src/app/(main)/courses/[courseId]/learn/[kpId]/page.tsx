import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { CurriculumChat } from "@/components/courses/curriculum-chat"

export default async function LearnPage({
  params,
}: {
  params: Promise<{ courseId: string; kpId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { kpId } = await params

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: kpId },
    include: { module: { select: { id: true, title: true, courseId: true, sortOrder: true } } },
  })
  if (!kp) notFound()

  const [course, siblings] = await Promise.all([
    prisma.course.findFirst({
      where: { id: kp.module.courseId, userId: session.user.id },
    }),
    prisma.knowledgePoint.findMany({
      where: { moduleId: kp.moduleId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, sortOrder: true },
    }),
  ])
  if (!course) notFound()
  const idx = siblings.findIndex((s) => s.id === kpId)

  const kpData = {
    ...JSON.parse(JSON.stringify(kp)),
    courseTitle: course.title,
    prev: idx > 0 ? siblings[idx - 1] : null,
    next: idx < siblings.length - 1 ? siblings[idx + 1] : null,
    isLastInModule: idx === siblings.length - 1,
    moduleKpCount: siblings.length,
  }

  return <CurriculumChat kp={kpData} />
}
