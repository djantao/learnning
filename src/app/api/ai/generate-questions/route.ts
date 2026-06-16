import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { knowledgePointId, style } = await req.json()
  if (!knowledgePointId) return NextResponse.json({ error: "缺少知识点ID" }, { status: 400 })

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: { select: { userId: true } } } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const isInterview = style === "interview"

  const prompt = isInterview
    ? `你是一位资深技术面试官。请根据以下知识点，出 5 道面试题。

知识点：${kp.title}
内容：
${getContentPlain(kp.content).slice(0, 2000)}

要求：
1. 模拟真实技术面试场景，题目由浅入深
2. 包含：1道基础概念题 + 2道场景应用题 + 1道系统设计/架构题 + 1道开放讨论题
3. 每道题后给出期望的回答要点（用"期望回答："标注）
4. 题目要有挑战性，能够区分不同水平的候选人

输出纯 JSON 数组（不要 markdown 代码块）：
["题目1\\n\\n期望回答：...","题目2\\n\\n期望回答：...",...]`
    : `你是一位严格的老师。请根据以下知识点内容，出 3 道简答题。

知识点：${kp.title}
内容：
${getContentPlain(kp.content).slice(0, 2000)}

要求：
1. 题目考察对核心概念的理解和应用，不能是照搬原文就能回答的
2. 题目由浅入深排列
3. 每道题一句话说清楚即可

输出纯 JSON 数组（不要 markdown 代码块）：
["题目1","题目2","题目3"]`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      maxTokens: isInterview ? 1500 : 800,
      task: "generate_questions",
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: "AI 返回格式异常" }, { status: 500 })

    let questions: string[]
    try { questions = JSON.parse(jsonMatch[0]) } catch {
      return NextResponse.json({ error: "题目解析失败" }, { status: 500 })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "未能生成题目" }, { status: 500 })
    }

    return NextResponse.json({ questions })
  } catch (error) {
    console.error("generate-questions error:", error)
    return NextResponse.json({ error: "题目生成失败" }, { status: 500 })
  }
}
