import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CourseList } from "@/components/courses/course-list"

export default async function CoursesPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { modules: true } } },
  })

  return <CourseList initialCourses={JSON.parse(JSON.stringify(courses))} />
}
