import { prisma } from "./db"
import { getCourseStats } from "./course-stats"
import { sendReminderEmail } from "./email"

export async function checkProjectDeadlines(userId: string) {
  const today = new Date(new Date().toDateString())

  const existing = await prisma.reminder.findFirst({
    where: { userId, type: "deadline_warning", createdAt: { gte: today } },
  })
  if (existing) return

  const goals = await prisma.learningGoal.findMany({
    where: { userId, targetDate: { not: null }, status: { not: "completed" } },
    include: {
      childGoals: { include: { course: { select: { id: true, title: true } } } },
      course: { select: { id: true, title: true } },
    },
  })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })

  for (const goal of goals) {
    if (!goal.targetDate) continue

    const courseIds = new Set<string>()
    if (goal.courseId) courseIds.add(goal.courseId)
    for (const child of goal.childGoals) {
      if (child.courseId) courseIds.add(child.courseId)
    }
    if (courseIds.size === 0) continue

    const statsArray = await Promise.all(
      [...courseIds].map((id) => getCourseStats(id))
    )

    const totalKps = statsArray.reduce((s, st) => s + st.totalKps, 0)
    const masteredKps = statsArray.reduce((s, st) => s + st.masteredKps, 0)
    const maxPredicted = Math.max(
      ...statsArray.map((s) => s.predictedDaysLeft).filter((d): d is number => d !== null),
      0
    )

    if (totalKps === 0 || masteredKps === totalKps) continue

    const predictedDate = new Date(today)
    predictedDate.setDate(predictedDate.getDate() + maxPredicted)

    if (predictedDate > goal.targetDate) {
      const daysLate = Math.ceil((predictedDate.getTime() - goal.targetDate.getTime()) / 86400000)

      await prisma.reminder.create({
        data: {
          userId,
          type: "deadline_warning",
          title: `项目延期：${goal.title}`,
          message: `按当前学习速度，预计 ${predictedDate.getMonth() + 1}月${predictedDate.getDate()}日 完成，比目标晚了 ${daysLate} 天。建议加快学习节奏！`,
          link: `/goals/${goal.id}`,
        },
      })

      if (user?.email) {
        await sendReminderEmail(
          userId,
          user.email,
          `[MindForge] 项目延期提醒：${goal.title}`,
          `<h3>项目「${goal.title}」可能延期</h3>
<p>目标完成日期：${goal.targetDate.toLocaleDateString("zh-CN")}</p>
<p>预计完成日期：${predictedDate.getMonth() + 1}月${predictedDate.getDate()}日（延迟 ${daysLate} 天）</p>
<p><a href="https://learnning-rho.vercel.app/goals/${goal.id}">查看详情</a></p>`,
        )
      }
    }
  }
}

export async function checkOverdueSchedules(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.reminder.findFirst({
    where: { userId, type: "schedule_overdue", createdAt: { gte: today } },
  })
  if (existing) return

  const overdueModules = await prisma.module.findMany({
    where: {
      course: { userId },
      scheduledDate: { lt: today },
      status: { not: "completed" },
    },
    select: {
      id: true, title: true, scheduledDate: true,
      course: { select: { id: true, title: true } },
    },
    orderBy: { scheduledDate: "asc" },
  })

  if (overdueModules.length === 0) return

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  const count = overdueModules.length
  const firstFew = overdueModules.slice(0, 5)
  const moduleList = firstFew.map((m) =>
    `- ${m.course.title} > ${m.title}（排期：${m.scheduledDate!.toLocaleDateString("zh-CN")}）`
  ).join("\n")

  await prisma.reminder.create({
    data: {
      userId,
      type: "schedule_overdue",
      title: `${count} 个学习模块延期未完成`,
      message: `以下模块已过排期日期但未完成：\n${moduleList}${count > 5 ? `\n... 还有 ${count - 5} 个` : ""}`,
      link: "/schedule",
    },
  })

  if (user?.email) {
    await sendReminderEmail(
      userId,
      user.email,
      `[MindForge] ${count} 个学习模块延期未完成`,
      `<h3>学习排期延期提醒</h3>
<p>你有 <strong>${count}</strong> 个模块已过排期日期但未完成：</p>
<ul>${firstFew.map((m) => `<li><strong>${m.course.title}</strong> > ${m.title}</li>`).join("")}</ul>
${count > 5 ? `<p>... 还有 ${count - 5} 个</p>` : ""}
<p><a href="https://learnning-rho.vercel.app/schedule">查看课表</a></p>`,
    )
  }
}
