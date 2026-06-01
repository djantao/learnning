import { prisma } from "./db"
import { scheduleCourse } from "./schedule"

/**
 * 计算近7天的学习节奏偏差率。
 * 偏差率 = (排期预估分钟 / 实际学习分钟) - 1
 * > +0.3 → 实际比预估慢，需后移
 * < -0.3 → 实际比预估快，可前移
 */
export async function computePaceDeviation(userId: string, courseId: string): Promise<{
  deviation: number
  actualMinutes: number
  scheduledMinutes: number
  daysWithData: number
} | null> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  // 近7天该课程的排期预估分钟（scheduledDate 在过去7天内的模块）
  const recentModules = await prisma.module.findMany({
    where: {
      courseId,
      scheduledDate: { gte: weekAgo, lt: today },
      estimatedMinutes: { not: null },
    },
    select: { estimatedMinutes: true },
  })
  const scheduledMinutes = recentModules.reduce((s, m) => s + (m.estimatedMinutes ?? 0), 0)

  // 近7天用户实际学习分钟（从 DailyActivity）
  const activities = await prisma.dailyActivity.findMany({
    where: {
      userId,
      date: { gte: weekAgo, lt: today },
    },
    select: { studyMinutes: true },
  })
  const actualMinutes = activities.reduce((s, a) => s + a.studyMinutes, 0)
  const daysWithData = activities.filter((a) => a.studyMinutes > 0).length

  if (actualMinutes === 0 || scheduledMinutes === 0) return null

  // 偏差 = (预估 / 实际) - 1，正值 = 比预期慢
  const deviation = scheduledMinutes / actualMinutes - 1
  return { deviation, actualMinutes, scheduledMinutes, daysWithData }
}

/**
 * 自适应排期：检测节奏偏差，偏差超 30% 时自动重排未完成模块。
 * 返回调整结果供 UI / Cron 使用。
 */
export async function adaptSchedule(
  userId: string,
  courseId: string
): Promise<{
  adjusted: boolean
  deviation: number | null
  actualMinutes: number
  scheduledMinutes: number
  message: string
}> {
  const pace = await computePaceDeviation(userId, courseId)

  if (!pace) {
    return {
      adjusted: false,
      deviation: null,
      actualMinutes: 0,
      scheduledMinutes: 0,
      message: "近7天无学习或排期数据，跳过自适应",
    }
  }

  const { deviation, actualMinutes, scheduledMinutes } = pace

  // 偏差在 ±30% 内 → 节奏正常，不调整
  if (Math.abs(deviation) <= 0.3) {
    return {
      adjusted: false,
      deviation,
      actualMinutes,
      scheduledMinutes,
      message: `学习节奏正常（偏差 ${Math.round(deviation * 100)}%），无需调整`,
    }
  }

  // 获取课程当前日学习时长配置
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { dailyStudyMinutes: true },
  })
  const dailyMinutes = course?.dailyStudyMinutes ?? 120

  // 偏差 > +0.3：实际比预估慢 → 保留已完成，重排未完成模块（天然后移）
  // 偏差 < -0.3：实际比预估快 → 保留已完成，重排未完成模块（天然前移）
  const result = await scheduleCourse(userId, courseId, dailyMinutes, undefined, true)

  const direction = deviation > 0 ? "落后" : "超前"
  const msg = `学习节奏${direction}（偏差 ${Math.round(Math.abs(deviation) * 100)}%），` +
    `近7天实际 ${actualMinutes} 分钟 vs 预估 ${scheduledMinutes} 分钟。` +
    `已自动重排 ${result.scheduled} 个未完成模块。`

  return {
    adjusted: true,
    deviation,
    actualMinutes,
    scheduledMinutes,
    message: msg,
  }
}
