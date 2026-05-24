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

/** 将模块列表按每日学习时长分配到具体日期 */
export function assignDates(flatModules: FlatModule[], dailyMinutes: number, startDate: Date): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = []
  let currentDate = new Date(startDate)
  let accumulated = 0

  for (const mod of flatModules) {
    if (accumulated + mod.estimatedMinutes > dailyMinutes && accumulated > 0) {
      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + 1)
      accumulated = 0
    }
    assignments.push({
      moduleId: mod.id,
      scheduledDate: new Date(currentDate),
    })
    accumulated += mod.estimatedMinutes
  }

  return assignments
}

/** 完整排期流程：查询模块树 → 分配日期 → 批量更新 DB → 更新 Course.dailyStudyMinutes */
export async function scheduleCourse(courseId: string, dailyMinutes: number, startDate?: Date) {
  const modules = await prisma.module.findMany({
    where: { courseId, parentModuleId: null },
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      sortOrder: true,
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

  const assignments = assignDates(flat, dailyMinutes, startDate ?? new Date())

  // 逐个更新（Neon HTTP 不支持 $transaction）
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
