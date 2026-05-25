import { prisma } from "./db"

/**
 * Compute progress for a single goal based on real data:
 * - If goal has materials (pages): progress = % of flashcards mastered from those pages
 * - If goal has child goals: progress = average of child progress
 * - If neither: 0%
 */
export async function computeGoalProgress(goalId: string): Promise<number> {
  const goal = await prisma.learningGoal.findUnique({
    where: { id: goalId },
    include: {
      materials: { include: { page: { include: { flashcards: true } } } },
      childGoals: true,
    },
  })

  if (!goal) return 0

  // If linked to a course, compute from KP mastery
  if (goal.courseId) {
    const kps = await prisma.knowledgePoint.findMany({
      where: { module: { courseId: goal.courseId } },
      select: { mastery: true },
    })
    if (kps.length > 0) {
      const mastered = kps.filter((k) => k.mastery >= 4).length
      return Math.round((mastered / kps.length) * 100)
    }
    return 0
  }

  // If has child goals, compute average
  if (goal.childGoals.length > 0) {
    const childProgress = await Promise.all(goal.childGoals.map((c) => computeGoalProgress(c.id)))
    return Math.round(childProgress.reduce((a, b) => a + b, 0) / childProgress.length)
  }

  // If has materials, compute from flashcard mastery
  if (goal.materials.length > 0) {
    let totalCards = 0
    let masteredCards = 0

    for (const mat of goal.materials) {
      if (mat.page) {
        const cards = await prisma.flashcard.findMany({
          where: { pageId: mat.page.id, isSuspended: false },
        })
        totalCards += cards.length
        // Weighted: not-reviewed=0, reviewed<7d=0.3, 7-21d=0.6, mastered>=21d=1.0
        for (const c of cards) {
          if (c.sm2Interval >= 21) masteredCards += 1
          else if (c.sm2Interval >= 7) masteredCards += 0.6
          else if (c.sm2Repetitions > 0) masteredCards += 0.3
        }
      }
    }

    if (totalCards > 0) {
      return Math.round((masteredCards / totalCards) * 100)
    }

    // Fallback: use material completion checkbox
    const completed = goal.materials.filter((m) => m.isCompleted).length
    return Math.round((completed / goal.materials.length) * 100)
  }

  return 0
}

/**
 * Recompute progress for a goal and all its ancestors
 */
export async function recomputeGoalTree(goalId: string) {
  const goal = await prisma.learningGoal.findUnique({ where: { id: goalId } })
  if (!goal) return

  // Compute progress for this goal
  const progress = await computeGoalProgress(goalId)

  // Auto-update status based on progress
  let status = goal.status
  if (progress === 100 && goal.status !== "completed") {
    status = "completed"
  } else if (progress > 0 && goal.status === "not_started") {
    status = "in_progress"
  }

  await prisma.learningGoal.update({
    where: { id: goalId },
    data: {
      progressPct: progress,
      status,
      ...(progress === 100 && !goal.completedAt ? { completedAt: new Date() } : {}),
    },
  })

  // Recurse to parent
  if (goal.parentGoalId) {
    await recomputeGoalTree(goal.parentGoalId)
  }
}

/**
 * Find all goals that reference a given page and recompute them
 */
export async function recomputeGoalsForPage(pageId: string) {
  const materials = await prisma.goalMaterial.findMany({
    where: { pageId },
    select: { goalId: true },
  })

  for (const mat of materials) {
    await recomputeGoalTree(mat.goalId)
  }
}
