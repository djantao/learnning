import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { recomputeForKnowledgePoint } from "@/lib/curriculum"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // 自由回忆评估模式（KP复习卡片用）— 仅返回AI反馈，不修改掌握度
  if (body.kpTitle && body.kpContent !== undefined && body.userRecall) {
    const { kpTitle, kpContent, userRecall } = body as {
      kpTitle: string; kpContent: string; userRecall: string
    }

    const prompt = `你是学习教练。学生正在复习「${kpTitle}」，以下是他/她主动回忆的内容。请对比原文，给出简短（50-80字）的反馈。

原文内容：
${kpContent.slice(0, 800)}

学生回忆内容：
${userRecall.slice(0, 1000)}

请评估：1) 回忆覆盖了哪些要点 2) 缺失了什么 3) 一句话鼓励/建议。用中文回复，直接给反馈文字，不要JSON。`

    try {
      const result = await chatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        maxTokens: 300,
      })
      const feedback = result.choices?.[0]?.message?.content ?? ""
      return NextResponse.json({ feedback: feedback.trim() })
    } catch {
      return NextResponse.json({ feedback: "" }, { status: 200 })
    }
  }

  // 原始模式：题目答案评估 + 更新掌握度
  const { knowledgePointId, question, userAnswer } = body as {
    knowledgePointId: string; question: string; userAnswer: string
  }

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: { select: { userId: true } } } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const prompt = `Evaluate this user answer to a review question.

Knowledge point: ${kp.title}
Question: ${question}
User answer: ${userAnswer}

Grade 0-5 where 0=no understanding, 3=basic, 5=excellent. Respond in Chinese as JSON:
{"grade": 4, "good": "what was correct", "missing": "what to improve", "saveAsFlashcard": false, "followUp": "next question to deepen understanding"}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      maxTokens: 800,
    })

    const text = result.choices?.[0]?.message?.content ?? "{}"
    const m = text.match(/\{[\s\S]*\}/)
    const evaluation = m ? JSON.parse(m[0]) : { grade: 3 }

    if (typeof evaluation.grade === "number") {
      const newMastery = Math.max(0, Math.min(5, Math.round((kp.mastery + evaluation.grade) / 2)))
      await prisma.knowledgePoint.update({
        where: { id: knowledgePointId },
        data: {
          mastery: newMastery,
          status: newMastery >= 4 ? "mastered" : newMastery > 0 ? "in_progress" : "not_started",
        },
      })
      recomputeForKnowledgePoint(knowledgePointId).catch(() => {})
    }

    return NextResponse.json(evaluation)
  } catch {
    return NextResponse.json({ error: "AI evaluation failed" }, { status: 500 })
  }
}
