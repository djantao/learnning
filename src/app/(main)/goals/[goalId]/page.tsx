import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getCourseStats } from "@/lib/course-stats"
import { ProjectDashboard } from "@/components/goals/project-dashboard"
import { notFound } from "next/navigation"

function collectCourses(goal: any): { courseId: string; courseTitle: string; goalTitle: string; childGoalId: string }[] {
  const results: { courseId: string; courseTitle: string; goalTitle: string; childGoalId: string }[] = []
  if (goal.courseId && goal.course) {
    results.push({ courseId: goal.courseId, courseTitle: goal.course.title, goalTitle: goal.title, childGoalId: goal.id })
  }
  for (const child of (goal.childGoals || [])) {
    results.push(...collectCourses(child))
  }
  return results
}

export default async function GoalPage({
  params,
}: {
  params: Promise<{ goalId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { goalId } = await params

  const goal = await prisma.learningGoal.findFirst({
    where: { id: goalId, userId: session.user.id },
    include: {
      childGoals: {
        include: {
          childGoals: {
            include: { childGoals: true },
          },
          course: { select: { id: true, title: true } },
        },
      },
      course: { select: { id: true, title: true } },
    },
  })

  if (!goal) notFound()

  // Deadline check via API route to avoid build issues
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/reminders/check-deadlines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: session.user.id }),
  }).catch(() => {})

  const courseEntries = collectCourses(goal)
  const uniqueCourses = courseEntries.filter(
    (e, i, arr) => arr.findIndex((x) => x.courseId === e.courseId) === i
  )

  const coursesWithStats = await Promise.all(
    uniqueCourses.map(async (entry) => ({
      ...entry,
      stats: await getCourseStats(entry.courseId),
    }))
  )

  const totalEstimated = coursesWithStats.reduce((s, c) => s + c.stats.estimatedMinutes, 0)
  const totalStudied = coursesWithStats.reduce((s, c) => s + c.stats.studiedMinutes, 0)
  const totalKps = coursesWithStats.reduce((s, c) => s + c.stats.totalKps, 0)
  const masteredKps = coursesWithStats.reduce((s, c) => s + c.stats.masteredKps, 0)
  const totalProgress = totalKps > 0 ? Math.round((masteredKps / totalKps) * 100) : 0

  const maxPredictedDays = coursesWithStats
    .map((c) => c.stats.predictedDaysLeft)
    .filter((d): d is number => d !== null)
  const totalPredicted = maxPredictedDays.length > 0 ? Math.max(...maxPredictedDays) : null

  const allCourses = await prisma.course.findMany({
    where: { userId: session.user.id },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  })

  const serialized = JSON.parse(JSON.stringify({
    goal: { id: goal.id, title: goal.title, description: goal.description, status: goal.status, childGoals: goal.childGoals },
    courses: coursesWithStats,
    availableCourses: allCourses,
    totalEstimatedMinutes: totalEstimated,
    totalStudiedMinutes: totalStudied,
    totalProgressPct: totalProgress,
    totalPredictedDays: totalPredicted,
    totalKps,
    totalMasteredKps: masteredKps,
  }))

  return <ProjectDashboard {...serialized} />
}
