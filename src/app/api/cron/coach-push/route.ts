// 每日检查学习状态，未学习则推送（Server酱 微信 / 邮件）

import { prisma } from "@/lib/db"
import { generateCoachQuestion } from "@/lib/ai/coach"
import { serverChanPush } from "@/lib/serverchan"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  return await runPushCheck(searchParams.get("force") === "true")
}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  return await runPushCheck(body.force === true)
}

async function runPushCheck(force = false) {
  const results: string[] = []

  const sessions = await prisma.coachSession.findMany({
    where: { status: "active" },
    include: {
      user: { select: { id: true } },
      knowledgePoint: { select: { title: true, content: true } },
      course: { select: { title: true } },
    },
  })

  results.push(`${sessions.length} 个活跃会话`)

  for (const session of sessions) {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const activity = await prisma.dailyActivity.findFirst({
      where: { userId: session.userId, date: today },
    })
    if (activity && (activity.kpsCompleted > 0 || activity.studyMinutes > 0)) {
      results.push(`${session.userId}: 今天已学习`)
      continue
    }

    if (!force && session.lastPushAt && session.lastPushAt >= today) {
      results.push(`${session.userId}: 今天已推送过`)
      continue
    }

    const kpTitle = session.knowledgePoint?.title ?? "当前知识点"
    const courseTitle = session.course?.title ?? "课程"
    const rounds = JSON.parse(session.roundsJson)

    const { question } = await generateCoachQuestion({
      courseTitle, moduleTitle: kpTitle, kpTitle,
      kpContent: session.knowledgePoint?.content ?? "",
      difficulty: session.difficulty, previousRounds: rounds.slice(-2),
    })

    const msg = `📚 ${courseTitle} · ${kpTitle}（${session.difficulty}）\n\n${question}\n\n👉 打开 learnning 写下你的回答`

    const pushed = await serverChanPush({ title: `📚 ${courseTitle} - 学习时间！`, content: msg })

    await prisma.coachSession.update({
      where: { id: session.id },
      data: { lastPushAt: new Date(), pushCount: { increment: 1 } },
    })

    results.push(`${session.userId}: ${pushed ? "✅ Server酱推送成功" : "❌ 未配置 SENDKEY"}`)
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() })
}
