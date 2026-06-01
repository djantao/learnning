import { prisma } from "@/lib/db"
import { checkProjectDeadlines, checkOverdueSchedules } from "@/lib/reminder-check"
import { rebalanceSchedule } from "@/lib/schedule"
import { adaptSchedule } from "@/lib/adaptive-schedule"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { courses: { some: { isActive: true } } },
    select: { id: true, name: true, courses: { where: { isActive: true }, select: { id: true, title: true } } },
    take: 50,
  })

  let checked = 0
  let adaptiveAdjusted = 0
  for (const user of users) {
    try {
      await Promise.all([
        checkProjectDeadlines(user.id),
        checkOverdueSchedules(user.id),
        rebalanceSchedule(user.id).catch(() => {}),
      ])

      // 自适应排期检查（每天只运行一次）
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

      const alreadyAdapted = await prisma.reminder.findFirst({
        where: { userId: user.id, type: "adaptive_schedule", createdAt: { gte: today } },
      })
      if (!alreadyAdapted) {
        for (const course of user.courses) {
          try {
            const result = await adaptSchedule(user.id, course.id)
            if (result.adjusted) {
              adaptiveAdjusted++
              await prisma.reminder.create({
                data: {
                  userId: user.id,
                  type: "adaptive_schedule",
                  title: `排期自适应调整：${course.title}`,
                  message: result.message,
                  link: `/courses/${course.id}`,
                },
              })
            }
          } catch { /* skip courses that error */ }
        }
      }

      // Study time reminder (morning/afternoon/evening)
      const hour = new Date().getHours()
      const inReminderWindow = (hour >= 8 && hour <= 9) || (hour >= 13 && hour <= 14) || (hour >= 18 && hour <= 19)
      if (inReminderWindow) {
        const periodLabel = hour < 12 ? "上午" : hour < 17 ? "下午" : "晚上"

        const todayCount = await prisma.module.count({
          where: { course: { userId: user.id }, scheduledDate: { gte: today, lt: tomorrow }, status: { not: "completed" } },
        })

        if (todayCount > 0) {
          const already = await prisma.reminder.findFirst({
            where: { userId: user.id, type: "study", title: { contains: periodLabel }, createdAt: { gte: today } },
          })
          if (!already) {
            await prisma.reminder.create({
              data: { userId: user.id, type: "study", title: `${periodLabel}学习提醒`, message: `今日有 ${todayCount} 个模块待学习`, link: "/" },
            })
          }
        }
      }
      checked++
    } catch { /* skip users that error */ }
  }

  return NextResponse.json({ ok: true, usersChecked: checked, adaptiveAdjusted })
}
