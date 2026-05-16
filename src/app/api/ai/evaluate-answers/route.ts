import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

interface QuestionResult {
  isCorrect: boolean
  correctAnswer: string
  explanation: string
}

interface Evaluation {
  feedback: string
  suggestedScore: number
  details: QuestionResult[]
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { knowledgePointId, questions, answers } = await req.json()
  if (!knowledgePointId || !questions || !answers) {
    return NextResponse.json({ error: "缺少必要字段" }, { status: 400 })
  }

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: { select: { userId: true } } } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const recentRecords = await prisma.practiceRecord.findMany({
    where: { userId: session.user.id, knowledgePointId },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { aiScore: true, aiFeedback: true, createdAt: true },
  })

  const historyContext = recentRecords.length > 0
    ? `\n该用户最近 ${recentRecords.length} 次练习记录：${recentRecords.map((r) => `\n- ${r.createdAt.toISOString().slice(0, 10)}: AI评估 ${r.aiScore ?? "?"}/5 分`).join("")}`
    : ""

  const qaText = questions.map((q: string, i: number) =>
    `题目${i + 1}：${q}\n用户回答：${answers[i] || "（未作答）"}`
  ).join("\n\n")

  const prompt = `你是一位严格的老师。请逐题批改学生的回答。

知识点：${kp.title}
当前掌握度：${kp.mastery}/5
${historyContext}

学生答题情况：
${qaText}

请逐题判断对错，给出中文正确答案和中文解析，然后给出中文总体评价和建议掌握度。所有文字内容必须使用中文。

输出纯 JSON（不要 markdown 代码块，不要英文）：
{
  "feedback": "总体评价（2-3句话）",
  "suggestedScore": 3,
  "details": [
    {
      "isCorrect": true,
      "correctAnswer": "正确答案或要点",
      "explanation": "解析说明"
    }
  ]
}

注意：details 数组长度必须与题目数量（${questions.length}）一致，按题目顺序排列。`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      maxTokens: 1200,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: "AI 返回格式异常" }, { status: 500 })

    let evaluation: Evaluation
    try { evaluation = JSON.parse(jsonMatch[0]) } catch {
      return NextResponse.json({ error: "评估结果解析失败" }, { status: 500 })
    }

    if (!evaluation.feedback || typeof evaluation.suggestedScore !== "number" || !Array.isArray(evaluation.details)) {
      return NextResponse.json({ error: "评估结果不完整" }, { status: 500 })
    }

    const suggestedScore = Math.min(5, Math.max(1, Math.round(evaluation.suggestedScore)))

    const record = await prisma.practiceRecord.create({
      data: {
        userId: session.user.id,
        knowledgePointId,
        questions: JSON.stringify(questions),
        userAnswers: JSON.stringify(answers),
        aiFeedback: evaluation.feedback,
        aiScore: suggestedScore,
        questionResults: JSON.stringify(evaluation.details),
      },
    })

    return NextResponse.json({
      feedback: evaluation.feedback,
      suggestedScore,
      recordId: record.id,
      details: evaluation.details,
    })
  } catch (error) {
    console.error("evaluate-answers error:", error)
    return NextResponse.json({ error: "评估失败" }, { status: 500 })
  }
}
