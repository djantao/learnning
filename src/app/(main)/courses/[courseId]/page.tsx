import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getCourseStats } from "@/lib/course-stats"
import { notFound } from "next/navigation"
import { CourseDetail } from "@/components/courses/course-detail"

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { courseId } = await params

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: session.user.id },
    include: {
      modules: {
        where: { parentModuleId: null },
        orderBy: { sortOrder: "asc" },
        include: {
          childModules: {
            orderBy: { sortOrder: "asc" },
            include: {
              childModules: {
                orderBy: { sortOrder: "asc" },
                include: { knowledgePoints: { orderBy: { sortOrder: "asc" } } },
              },
              knowledgePoints: { orderBy: { sortOrder: "asc" } },
            },
          },
          knowledgePoints: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  })

  if (!course) notFound()

  const stats = await getCourseStats(courseId)

  return (
    <CourseDetail
      course={JSON.parse(JSON.stringify(course))}
      stats={JSON.parse(JSON.stringify(stats))}
    />
  )
}
