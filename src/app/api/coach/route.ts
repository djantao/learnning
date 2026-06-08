import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import {
  getOrCreateSession,
  generateCoachQuestion,
  evaluateCoachAnswer,
  appendRound,
  updateSessionProgress,
  type CoachRound,
} from "@/lib/ai/coach"
import { prisma } from "@/lib/db"

// GET /api/coach — 获取当前教练会话状态
// 支持 ?kpId=xxx 指定知识点
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetKpId = searchParams.get("kpId")

  const state = await getOrCreateSession(session.user.id, targetKpId || undefined)
  if (!state) {
    return NextResponse.json({ ready: false, message: "还没有学习计划" })
  }

  return NextResponse.json(state)
}

// POST /api/coach — 执行教练动作
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { action, answer, question, referenceAnswer, difficulty, kpTitle } = await req.json()

  switch (action) {
    case "question": {
      // 生成一个新问题
      const state = await getOrCreateSession(session.user.id)
      if (!state) return NextResponse.json({ error: "没有学习计划，请先创建课程" }, { status: 400 })

      // 获取当前 KP 的完整内容
      const cs = await prisma.coachSession.findUnique({
        where: { id: state.sessionId },
        include: { knowledgePoint: { select: { content: true, title: true } } },
      })

      if (!cs?.knowledgePoint) {
        return NextResponse.json({ error: "无法获取知识点信息" }, { status: 500 })
      }

      const { question, referenceAnswer: ref } = await generateCoachQuestion({
        courseTitle: state.courseTitle,
        moduleTitle: state.kpTitle,
        kpTitle: cs.knowledgePoint.title,
        kpContent: cs.knowledgePoint.content,
        difficulty: state.difficulty,
        previousRounds: state.rounds,
      })

      return NextResponse.json({
        question,
        referenceAnswer: ref,
        sessionId: state.sessionId,
        difficulty: state.difficulty,
      })
    }

    case "answer": {
      // 评价用户回答
      if (!answer || !question) {
        return NextResponse.json({ error: "缺少回答或问题" }, { status: 400 })
      }

      const state = await getOrCreateSession(session.user.id)
      if (!state) return NextResponse.json({ error: "没有活跃的教练会话" }, { status: 400 })

      const evaluation = await evaluateCoachAnswer({
        question,
        userAnswer: answer,
        referenceAnswer: referenceAnswer || "",
        difficulty: difficulty || state.difficulty,
        kpTitle: kpTitle || state.kpTitle,
        previousRounds: state.rounds,
      })

      // 保存这一轮对话
      const round: CoachRound = {
        q: question,
        a: answer,
        feedback: evaluation.feedback,
        reference: referenceAnswer,
        followUp: evaluation.followUp,
        at: new Date().toISOString(),
      }
      await appendRound(state.sessionId, round)

      // 如果评分 >= 4，可以考虑提升难度
      if (evaluation.score >= 4 && state.difficulty !== "高阶") {
        const nextDifficulty = state.difficulty === "入门" ? "进阶" : "高阶"
        await updateSessionProgress(state.sessionId, { difficulty: nextDifficulty })
      }

      return NextResponse.json({
        feedback: evaluation.feedback,
        followUp: evaluation.followUp,
        score: evaluation.score,
      })
    }

    case "reset": {
      // 重置会话
      const state = await getOrCreateSession(session.user.id)
      if (state) {
        await updateSessionProgress(state.sessionId, { status: "completed" })
      }
      const newState = await getOrCreateSession(session.user.id)
      return NextResponse.json({ message: "已重置", session: newState })
    }

    default:
      return NextResponse.json({ error: "未知动作，支持: question | answer | reset" }, { status: 400 })
  }
}
