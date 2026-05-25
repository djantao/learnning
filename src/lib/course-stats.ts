import { prisma } from "./db"

interface ModuleStats {
  id: string
  title: string
  estimatedMinutes: number
  totalKps: number
  masteredKps: number
  progressPct: number
  children: ModuleStats[]
}

interface CourseStats {
  totalKps: number
  masteredKps: number
  progressPct: number
  estimatedMinutes: number
  studiedMinutes: number
  predictedDaysLeft: number | null
  modules: ModuleStats[]
}

async function getModuleStats(moduleId: string): Promise<ModuleStats> {
  const mod = await prisma.module.findUniqueOrThrow({
    where: { id: moduleId },
    include: {
      childModules: { select: { id: true }, orderBy: { sortOrder: "asc" } },
      knowledgePoints: { select: { mastery: true } },
    },
  })

  const totalKps = mod.knowledgePoints.length
  const masteredKps = mod.knowledgePoints.filter((k) => k.mastery >= 4).length

  const children = await Promise.all(
    mod.childModules.map((c) => getModuleStats(c.id))
  )

  const childrenKps = children.reduce((s, c) => s + c.totalKps, 0)
  const childrenMastered = children.reduce((s, c) => s + c.masteredKps, 0)
  const childrenMinutes = children.reduce((s, c) => s + c.estimatedMinutes, 0)

  return {
    id: mod.id,
    title: mod.title,
    estimatedMinutes: (mod.estimatedMinutes ?? 0) + childrenMinutes,
    totalKps: totalKps + childrenKps,
    masteredKps: masteredKps + childrenMastered,
    progressPct: (totalKps + childrenKps) > 0
      ? Math.round(((masteredKps + childrenMastered) / (totalKps + childrenKps)) * 100)
      : 0,
    children,
  }
}

export async function getCourseStats(courseId: string): Promise<CourseStats> {
  const topModules = await prisma.module.findMany({
    where: { courseId, parentModuleId: null },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  })

  const modules = await Promise.all(topModules.map((m) => getModuleStats(m.id)))

  const totalKps = modules.reduce((s, m) => s + m.totalKps, 0)
  const masteredKps = modules.reduce((s, m) => s + m.masteredKps, 0)
  const estimatedMinutes = modules.reduce((s, m) => s + m.estimatedMinutes, 0)
  const progressPct = totalKps > 0 ? Math.round((masteredKps / totalKps) * 100) : 0

  let predictedDaysLeft: number | null = null
  if (totalKps > 0 && masteredKps > 0 && masteredKps < totalKps) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentCompleted = await prisma.knowledgePoint.count({
      where: {
        module: { courseId },
        mastery: { gte: 4 },
        completedAt: { gte: sevenDaysAgo },
      },
    })

    const dailyRate = Math.max(recentCompleted / 7, 0.1)
    const remaining = totalKps - masteredKps
    predictedDaysLeft = Math.ceil(remaining / dailyRate)
  }

  return {
    totalKps,
    masteredKps,
    progressPct,
    estimatedMinutes,
    studiedMinutes: Math.round((progressPct / 100) * estimatedMinutes),
    predictedDaysLeft,
    modules,
  }
}

export type { CourseStats, ModuleStats }
