// Vercel Cron: 每天检查学习状态，未学习则推送微信消息

import { prisma } from "@/lib/db"
import { generateCoachQuestion } from "@/lib/ai/coach"
import { sendTemplateMessage, sendCustomMessage, isWeChatConfigured } from "@/lib/wechat"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { NextResponse } from "next/server"

export async function GET() { return await runPushCheck() }
export async function POST() { return await runPushCheck() }

async function runPushCheck() {
  const results: string[] = []

  const sessions = await prisma.coachSession.findMany({
    where: { status: "active" },
    include: {
      user: { select: { id: true, email: true } },
      knowledgePoint: { select: { title: true, content: true } },
      course: { select: { title: true } },
    },
  })

  results.push(`Found ${sessions.length} active coach sessions`)

  for (const session of sessions) {
    const userId = session.userId
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activity = await prisma.dailyActivity.findFirst({ where: { userId, date: today } })

    if (activity && (activity.cardsReviewed > 0 || activity.kpsCompleted > 0 || activity.studyMinutes > 0)) {
      results.push(`User ${userId}: 今天已学习，跳过`)
      continue
    }

    if (session.lastPushAt && session.lastPushAt >= today) {
      results.push(`User ${userId}: 今天已推送过`)
      continue
    }

    const kpTitle = session.knowledgePoint?.title ?? "当前知识点"
    const kpContent = session.knowledgePoint?.content ?? ""
    const courseTitle = session.course?.title ?? "课程"
    const rounds = JSON.parse(session.roundsJson)

    const { question } = await generateCoachQuestion({
      courseTitle, moduleTitle: kpTitle, kpTitle, kpContent,
      difficulty: session.difficulty, previousRounds: rounds.slice(-2),
    })

    const wechatReady = isWeChatConfigured()
    let pushed = false

    if (wechatReady) {
      const openId = process.env.WECHAT_OPENID!
      const templateId = process.env.WECHAT_TEMPLATE_ID

      if (templateId) {
        pushed = await sendTemplateMessage({
          openId, templateId,
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/coach`,
          data: {
            first: { value: `📚 ${courseTitle} - 学习时间！`, color: "#1a1a1a" },
            keyword1: { value: question.slice(0, 50) + (question.length > 50 ? "..." : ""), color: "#2563eb" },
            keyword2: { value: `${session.difficulty}层级 · ${kpTitle}`, color: "#6b7280" },
            remark: { value: "点击查看完整问题并开始学习 👆", color: "#9ca3af" },
          },
        })
      } else {
        const msg = `📚 学习时间！\n\n课程：${courseTitle}\n知识点：${kpTitle}\n难度：${session.difficulty}\n\n${question}\n\n👉 点击回复你的想法`
        pushed = await sendCustomMessage({ openId, content: msg })
      }
    }

    await prisma.coachSession.update({
      where: { id: session.id },
      data: { lastPushAt: new Date(), pushCount: { increment: 1 } },
    })

    results.push(`User ${userId}: ${pushed ? "✅ 推送成功" : wechatReady ? "❌ 推送失败" : "⚠️ 微信未配置"}`)
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() })
}
