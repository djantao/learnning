import { prisma } from "./db"

interface FlatModule {
  id: string
  title: string
  estimatedMinutes: number
}

interface ScheduleAssignment {
  moduleId: string
  scheduledDate: Date
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** DFS 扁平化模块树，按 sortOrder 排序，仅保留有预估时长的模块 */
export function flattenModules(modules: {
  id: string
  title: string
  estimatedMinutes: number | null
  childModules?: any[]
  sortOrder: number
}[]): FlatModule[] {
  const result: FlatModule[] = []
  for (const mod of modules) {
    if ((mod.estimatedMinutes ?? 0) > 0) {
      result.push({ id: mod.id, title: mod.title, estimatedMinutes: mod.estimatedMinutes! })
    }
    if (mod.childModules?.length) {
      result.push(...flattenModules(mod.childModules))
    }
  }
  return result
}

/**
 * 分配日期 — 考虑其他课程已占用的日期容量。
 * existingOccupancy: dateStr → 该日已被其他课程占用的分钟数
 * dailyMinutes: 用户每日总学习时长上限
 */
export function assignDates(
  flatModules: FlatModule[],
  dailyMinutes: number,
  startDate: Date,
  existingOccupancy: Map<string, number> = new Map()
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = []
  let currentDate = new Date(startDate)
  let accumulated = existingOccupancy.get(fmtDate(currentDate)) ?? 0

  for (const mod of flatModules) {
    // 当前日期容量不够 → 往后顺移
    while (accumulated + mod.estimatedMinutes > dailyMinutes) {
      currentDate = addDays(currentDate, 1)
      accumulated = existingOccupancy.get(fmtDate(currentDate)) ?? 0
    }

    assignments.push({
      moduleId: mod.id,
      scheduledDate: new Date(currentDate),
    })
    accumulated += mod.estimatedMinutes
  }

  return assignments
}

/** 完整排期流程：读取已有排期 → 计算每日余量 → 插入新模块 → 批量更新 */
export async function scheduleCourse(
  userId: string,
  courseId: string,
  dailyMinutes: number,
  startDate?: Date
) {
  const modules = await prisma.module.findMany({
    where: { courseId, parentModuleId: null },
    select: {
      id: true, title: true, estimatedMinutes: true, sortOrder: true,
      childModules: {
        select: {
          id: true, title: true, estimatedMinutes: true, sortOrder: true,
          childModules: {
            select: { id: true, title: true, estimatedMinutes: true, sortOrder: true },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  const flat = flattenModules(modules)
  if (flat.length === 0) {
    return { scheduled: 0, message: "没有含预估时长的模块，请先估算学习时长" }
  }

  // 查询该用户其他课程已排期的模块，构建每日占用表
  const existingScheduled = await prisma.module.findMany({
    where: {
      course: { userId },
      scheduledDate: { not: null },
      courseId: { not: courseId }, // 排除当前课程（重新排期场景）
    },
    select: { estimatedMinutes: true, scheduledDate: true },
  })

  const occupancyMap = new Map<string, number>()
  for (const m of existingScheduled) {
    if (!m.scheduledDate) continue
    const key = fmtDate(m.scheduledDate)
    occupancyMap.set(key, (occupancyMap.get(key) ?? 0) + (m.estimatedMinutes ?? 0))
  }

  const start = startDate ?? new Date()
  // 确保 startDate 不会落在已被占满的日期
  let actualStart = new Date(start)
  while ((occupancyMap.get(fmtDate(actualStart)) ?? 0) >= dailyMinutes) {
    actualStart = addDays(actualStart, 1)
  }

  const assignments = assignDates(flat, dailyMinutes, actualStart, occupancyMap)

  await Promise.all(
    assignments.map((a) =>
      prisma.module.update({
        where: { id: a.moduleId },
        data: { scheduledDate: a.scheduledDate },
      })
    )
  )

  await prisma.course.update({
    where: { id: courseId },
    data: { dailyStudyMinutes: dailyMinutes },
  })

  return { scheduled: assignments.length, assignments }
}

/** 获取用户今日排期的模块 */
export async function getTodayModules(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return prisma.module.findMany({
    where: {
      course: { userId },
      scheduledDate: { gte: today, lt: tomorrow },
    },
    select: {
      id: true, title: true, status: true, progressPct: true,
      estimatedMinutes: true, scheduledDate: true,
      course: { select: { id: true, title: true, icon: true, color: true } },
    },
    orderBy: { sortOrder: "asc" },
  })
}

/** 获取用户未来 N 天内的排期模块 */
export async function getUpcomingModules(userId: string, days = 14) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + days)

  return prisma.module.findMany({
    where: {
      course: { userId },
      scheduledDate: { gte: today, lt: end },
    },
    select: {
      id: true, title: true, status: true, progressPct: true,
      estimatedMinutes: true, scheduledDate: true, sortOrder: true,
      course: { select: { id: true, title: true, icon: true, color: true } },
      parentModule: { select: { id: true, title: true } },
    },
    orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
  })
}
