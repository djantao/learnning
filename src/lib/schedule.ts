import { prisma } from "./db"
import { sendReminderEmail } from "./email"

interface FlatModule {
  id: string
  title: string
  estimatedMinutes: number
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
