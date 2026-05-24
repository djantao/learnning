import { prisma } from "@/lib/db"

/**
 * Compute progress for a single module.
 * Leaf modules: average of knowledge point mastery (0-5 mapped to percentage).
 * Parent modules: average of child module progress.
 */
export async function computeModuleProgress(moduleId: string): Promise<number> {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      childModules: { select: { id: true } },
      knowledgePoints: { select: { mastery: true } },
    },
  })
  if (!mod) return 0

  if (mod.childModules.length > 0) {
    const childProgresses = await Promise.all(
      mod.childModules.map((c) => computeModuleProgress(c.id))
    )
    if (childProgresses.length === 0) return 0
    return Math.round(childProgresses.reduce((s, p) => s + p, 0) / childProgresses.length)
  }

  if (mod.knowledgePoints.length === 0) return 0
  const avgMastery =
    mod.knowledgePoints.reduce((s, kp) => s + kp.mastery, 0) / mod.knowledgePoints.length
  return Math.round((avgMastery / 5) * 100)
}

/**
 * Recompute module progress and bubble up to ancestors.
 */
export async function recomputeModuleTree(moduleId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { parentModuleId: true, status: true },
  })
  if (!mod) return

  const progressPct = await computeModuleProgress(moduleId)

  let status = mod.status
  if (progressPct >= 100 && mod.status !== "completed") {
    status = "completed"
  } else if (progressPct > 0 && mod.status === "not_started") {
    status = "in_progress"
  }

  await prisma.module.update({
    where: { id: moduleId },
    data: { progressPct, status },
  })

  if (mod.parentModuleId) {
    await recomputeModuleTree(mod.parentModuleId)
  }
}

/**
 * Called when a knowledge point's mastery changes.
 */
export async function recomputeForKnowledgePoint(knowledgePointId: string) {
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    select: { moduleId: true },
  })
  if (!kp) return
  await recomputeModuleTree(kp.moduleId)

  // Also recompute goals linked to this course
  const mod = await prisma.module.findUnique({
    where: { id: kp.moduleId },
    select: { courseId: true },
  })
  if (mod?.courseId) {
    const linkedGoals = await prisma.learningGoal.findMany({
      where: { courseId: mod.courseId },
      select: { id: true },
    })
    for (const g of linkedGoals) {
      const { recomputeGoalTree } = await import("./goals")
      await recomputeGoalTree(g.id)
    }
  }
}

/** mastery 0-5 → 三档标签 */
export function masteryLabel(mastery: number): { label: string; color: string } {
  if (mastery >= 5) return { label: "掌握", color: "green" }
  if (mastery >= 3) return { label: "熟练", color: "amber" }
  return { label: "薄弱", color: "red" }
}

/** 计算模块掌握率 — 递归统计所有 KP 的三档分布 */
export async function moduleMasteryRate(moduleId: string) {
  const mod = await prisma.module.findUniqueOrThrow({
    where: { id: moduleId },
    include: {
      childModules: { select: { id: true } },
      knowledgePoints: { select: { mastery: true } },
    },
  })

  let total = 0
  let mastered = 0
  let medium = 0
  let weak = 0

  for (const kp of mod.knowledgePoints) {
    total++
    if (kp.mastery >= 5) mastered++
    else if (kp.mastery >= 3) medium++
    else weak++
  }

  for (const child of mod.childModules) {
    const childRate = await moduleMasteryRate(child.id)
    total += childRate.total
    mastered += childRate.mastered
    medium += childRate.medium
    weak += childRate.weak
  }

  const ratePct = total > 0 ? Math.round((mastered / total) * 100) : 0
  return { total, mastered, medium, weak, ratePct }
}
