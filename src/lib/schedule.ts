import { prisma } from "./db"
import { sendReminderEmail } from "./email"

interface FlatModule {
  id: string
  title: string
  estimatedMinutes: number
  status?: string
}

/** 解析 weeklySchedule JSON，返回日容量映射。0=周日, 6=周六 */
function parseWeeklySchedule(raw: string | null | undefined): Record<number, number> | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    const map: Record<number, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const day = parseInt(k)
      if (day >= 0 && day <= 6 && typeof v === "number") {
        map[day] = v
      }
    }
    return Object.keys(map).length > 0 ? map : undefined
  } catch {
    return undefined
  }
}

/** 获取某天的容量：优先用 weeklySchedule 中该日的值，0=休息日 */
function getDayCapacity(date: Date, defaultMinutes: number, weeklySchedule?: Record<number, number>): number {
  if (!weeklySchedule) return defaultMinutes
  const v = weeklySchedule[date.getDay()]
  if (v === undefined) return defaultMinutes
  return v
}

interface ScheduleAssignment {
  moduleId: string
  scheduledDate: Date
}

export interface OverdueDetail {
  moduleId: string
  title: string
  courseTitle: string
  scheduledDate: Date
  overdueDays: number
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
  status?: string
  childModules?: any[]
  sortOrder: number
}[]): FlatModule[] {
  const result: FlatModule[] = []
  for (const mod of modules) {
    if ((mod.estimatedMinutes ?? 0) > 0) {
      result.push({ id: mod.id, title: mod.title, estimatedMinutes: mod.estimatedMinutes!, status: mod.status })
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
 * dailyMinutes: 用户每日总学习时长上限（当 weeklySchedule 未提供时使用）
 * weeklySchedule: 0=周日~6=周六 的日容量（分钟），0=休息日跳过。未指定时均匀分配
 */
export function assignDates(
  flatModules: FlatModule[],
  dailyMinutes: number,
  startDate: Date,
  existingOccupancy: Map<string, number> = new Map(),
  weeklySchedule?: Record<number, number>
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = []
  let currentDate = new Date(startDate)
  let accumulated = existingOccupancy.get(fmtDate(currentDate)) ?? 0

  for (const mod of flatModules) {
    // 找下一个可用日期：容量够 + 非休息日
    while (true) {
      const cap = getDayCapacity(currentDate, dailyMinutes, weeklySchedule)
      if (cap === 0) {
        // 休息日，整日跳过
        currentDate = addDays(currentDate, 1)
        accumulated = existingOccupancy.get(fmtDate(currentDate)) ?? 0
        continue
      }
      if (accumulated + mod.estimatedMinutes > cap) {
        currentDate = addDays(currentDate, 1)
        accumulated = existingOccupancy.get(fmtDate(currentDate)) ?? 0
        continue
      }
      break
    }

    assignments.push({
      moduleId: mod.id,
      scheduledDate: new Date(currentDate),
    })
    accumulated += mod.estimatedMinutes
  }

  return assignments
}

/** 完整排期流程：读取已有排期 → 计算每日余量 → 插入新模块 → 批量更新
 * @param skipCompleted 为 true 时已完成模块保留原排期，仅重排未完成模块（用于自适应调整）
 */
export async function scheduleCourse(
  userId: string,
  courseId: string,
  dailyMinutes: number,
  startDate?: Date,
  skipCompleted = false
) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { weeklySchedule: true },
  })
  const weeklySchedule = parseWeeklySchedule(course?.weeklySchedule)

  const statusFilter = skipCompleted ? { not: "completed" } : undefined

  const modules = await prisma.module.findMany({
    where: { courseId, parentModuleId: null, ...(statusFilter ? { status: statusFilter } : {}) },
    select: {
      id: true, title: true, estimatedMinutes: true, sortOrder: true, status: true,
      childModules: {
        select: {
          id: true, title: true, estimatedMinutes: true, sortOrder: true, status: true,
          childModules: {
            select: { id: true, title: true, estimatedMinutes: true, sortOrder: true, status: true },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  const flat = flattenModules(modules)
  if (flat.length === 0) {
    return { scheduled: 0, message: skipCompleted ? "所有模块均已完成" : "没有含预估时长的模块，请先估算学习时长" }
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

  // skipCompleted：将本课程已完成模块的占位加入 occupancyMap
  if (skipCompleted) {
    const completedInCourse = await prisma.module.findMany({
      where: { courseId, status: "completed", scheduledDate: { not: null } },
      select: { estimatedMinutes: true, scheduledDate: true },
    })
    for (const m of completedInCourse) {
      if (!m.scheduledDate) continue
      const key = fmtDate(m.scheduledDate)
      occupancyMap.set(key, (occupancyMap.get(key) ?? 0) + (m.estimatedMinutes ?? 0))
    }
  }

  const start = startDate ?? new Date()
  // 确保 startDate 不会落在已被占满的日期（考虑弹性节奏下的日容量）
  let actualStart = new Date(start)
  while (true) {
    const cap = getDayCapacity(actualStart, dailyMinutes, weeklySchedule)
    if (cap === 0) { actualStart = addDays(actualStart, 1); continue }
    if ((occupancyMap.get(fmtDate(actualStart)) ?? 0) >= cap) { actualStart = addDays(actualStart, 1); continue }
    break
  }

  const assignments = assignDates(flat, dailyMinutes, actualStart, occupancyMap, weeklySchedule)

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

/** 弹性排期：逾期模块后移 + 明天容量不足则顺延。返回移动详情供 UI 展示逾期天数 */
export async function rebalanceSchedule(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const overdue = await prisma.module.findMany({
    where: {
      course: { userId },
      scheduledDate: { lt: today },
      status: { not: "completed" },
    },
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      scheduledDate: true,
      course: { select: { id: true, title: true } },
    },
  })

  const details: OverdueDetail[] = []

  for (const m of overdue) {
    const overdueDays = m.scheduledDate
      ? Math.ceil((today.getTime() - new Date(m.scheduledDate).getTime()) / 86400000)
      : 0

    details.push({
      moduleId: m.id,
      title: m.title,
      courseTitle: m.course.title,
      scheduledDate: m.scheduledDate!,
      overdueDays,
    })
  }

  // 批量更新所有逾期模块，避免 N 次串行 DB 写入
  if (details.length > 0) {
    await prisma.module.updateMany({
      where: { id: { in: details.map((d) => d.moduleId) } },
      data: { scheduledDate: new Date(tomorrow) },
    })
  }

  // 创建提醒 + 发邮件通知
  if (details.length > 0) {
    const todayStr = today.toLocaleDateString("zh-CN")
    const notificationExist = await prisma.reminder.findFirst({
      where: { userId, type: "schedule_overdue", createdAt: { gte: today } },
    })
    if (!notificationExist) {
      const totalDays = details.reduce((s, d) => s + d.overdueDays, 0)
      const firstFew = details.slice(0, 5)
      const moduleList = firstFew
        .map((d) => `- ${d.courseTitle} > ${d.title}（原排期 ${d.scheduledDate.toLocaleDateString("zh-CN")}，已逾期 ${d.overdueDays} 天）`)
        .join("\n")

      await prisma.reminder.create({
        data: {
          userId,
          type: "schedule_overdue",
          title: `${details.length} 个模块逾期（累计 ${totalDays} 天），已自动后移`,
          message: `${todayStr} 自动调整：\n${moduleList}${details.length > 5 ? `\n... 还有 ${details.length - 5} 个` : ""}\n\n已统一移至明天（${tomorrow.toLocaleDateString("zh-CN")}），请合理安排学习时间。`,
          link: "/schedule",
        },
      })

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
      if (user?.email) {
        const emailHtml = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
<h3 style="color:#e74c3c;">学习排期逾期提醒</h3>
<p>${user.name ?? "同学"}，以下 ${details.length} 个学习模块已逾期：</p>
<table style="width:100%;border-collapse:collapse;">
<tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;border:1px solid #ddd;">模块</th><th style="padding:8px;text-align:left;border:1px solid #ddd;">原排期</th><th style="padding:8px;text-align:center;border:1px solid #ddd;">逾期天数</th></tr>
${details.map((d) => `<tr><td style="padding:8px;border:1px solid #ddd;">${d.courseTitle} > ${d.title}</td><td style="padding:8px;border:1px solid #ddd;">${d.scheduledDate.toLocaleDateString("zh-CN")}</td><td style="padding:8px;text-align:center;border:1px solid #ddd;color:#e74c3c;font-weight:bold;">${d.overdueDays} 天</td></tr>`).join("")}
</table>
<p style="margin-top:16px;">已自动移至 <strong>${tomorrow.toLocaleDateString("zh-CN")}</strong>，请合理安排学习时间。</p>
<p style="color:#999;font-size:12px;"><a href="https://learnning-rho.vercel.app/schedule">查看课表</a></p>
</div>`
        await sendReminderEmail(
          userId,
          user.email,
          `[MindForge] ${details.length} 个模块逾期 ${totalDays} 天，已自动后移`,
          emailHtml,
        )
      }
    }
  }

  return { moved: details.length, details }
}

/** 根据目标截止日期计算每日学习需求 */
export async function getDailyRequirement(goalId: string) {
  const goal = await prisma.learningGoal.findUnique({
    where: { id: goalId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          dailyStudyMinutes: true,
          modules: {
            where: { parentModuleId: null },
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
          },
        },
      },
    },
  })

  if (!goal?.targetDate || !goal?.course) {
    return { dailyKpsNeeded: null, dailyMinutesNeeded: null, feasible: null, totalRemaining: 0, daysLeft: 0 }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(goal.targetDate)
  target.setHours(23, 59, 59, 999)
  const daysLeft = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86400000))

  const flat = flattenModules(goal.course.modules)
  const totalMinutes = flat.reduce((s, m) => s + m.estimatedMinutes, 0)

  const kpCount = await prisma.knowledgePoint.count({
    where: {
      module: { courseId: goal.course.id },
      mastery: { lt: 4 },
    },
  })

  const dailyKpsNeeded = Math.ceil(kpCount / daysLeft)
  const dailyMinutesNeeded = Math.ceil(totalMinutes * ((100 - goal.progressPct) / 100) / daysLeft)
  const feasible = goal.course.dailyStudyMinutes
    ? dailyMinutesNeeded <= goal.course.dailyStudyMinutes
    : dailyMinutesNeeded <= 180

  return { dailyKpsNeeded, dailyMinutesNeeded, feasible, totalRemaining: kpCount, daysLeft }
}

/** 根据目标截止日期自动排期 */
export async function scheduleFromGoal(userId: string, goalId: string, targetDate: Date) {
  const goal = await prisma.learningGoal.findUnique({
    where: { id: goalId },
    include: { course: { select: { id: true, title: true } } },
  })

  if (!goal?.course) {
    return { success: false, message: "目标未关联课程" }
  }

  const { dailyMinutesNeeded } = await getDailyRequirement(goalId)
  if (!dailyMinutesNeeded) {
    return { success: false, message: "无法计算每日需求" }
  }

  await prisma.learningGoal.update({
    where: { id: goalId },
    data: { targetDate, status: "in_progress" },
  })

  const dailyMinutes = Math.max(30, Math.ceil(dailyMinutesNeeded / 30) * 30)
  const result = await scheduleCourse(userId, goal.course.id, dailyMinutes)

  return { success: true, dailyMinutes, ...result }
}
