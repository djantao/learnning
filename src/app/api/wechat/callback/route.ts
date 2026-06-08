// 微信服务器回调 — 验证 + 接收消息

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateCoachQuestion } from "@/lib/ai/coach"
import { sendCustomMessage } from "@/lib/wechat"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const echostr = searchParams.get("echostr")
  if (echostr) return new Response(echostr)
  return new Response("ok")
}

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const openIdMatch = body.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)
    const contentMatch = body.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)

    if (!openIdMatch || !contentMatch) return new Response("success")

    const openId = openIdMatch[1]
    const content = contentMatch[1]

    if (openId !== process.env.WECHAT_OPENID) return new Response("success")

    const userId = process.env.WECHAT_USER_ID
    if (!userId) return new Response("success")

    const coachSession = await prisma.coachSession.findFirst({
      where: { userId, status: "active" },
      include: {
        knowledgePoint: { select: { title: true, content: true } },
        course: { select: { title: true } },
      },
    })

    if (!coachSession) {
      await sendCustomMessage({ openId, content: "你还没有活跃的学习教练。请先在 learnning 中学习后再来。" })
      return new Response("success")
    }

    // 用户回复了 — 保存回答并发新问题
    const rounds = JSON.parse(coachSession.roundsJson)
    const lastRound = rounds[rounds.length - 1]

    if (lastRound?.q && !lastRound.a) {
      // 这是对上一条问题的回答
      lastRound.a = content
      lastRound.at = new Date().toISOString()
      await prisma.coachSession.update({
        where: { id: coachSession.id },
        data: { roundsJson: JSON.stringify(rounds) },
      })
    }

    // 生成新问题
    const { question } = await generateCoachQuestion({
      courseTitle: coachSession.course?.title ?? "课程",
      moduleTitle: coachSession.knowledgePoint?.title ?? "",
      kpTitle: coachSession.knowledgePoint?.title ?? "",
      kpContent: coachSession.knowledgePoint?.content ?? "",
      difficulty: coachSession.difficulty,
      previousRounds: rounds.slice(-2),
    })

    rounds.push({ q: question, at: new Date().toISOString() })
    await prisma.coachSession.update({
      where: { id: coachSession.id },
      data: { roundsJson: JSON.stringify(rounds), lastPushAt: new Date(), pushCount: { increment: 1 } },
    })

    await sendCustomMessage({ openId, content: question })

    return new Response("success")
  } catch (error) {
    console.error("WeChat callback error:", error)
    return new Response("success")
  }
}
