import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { knowledgePointId, title, moduleTitle, courseTitle, level } = body

  if (!knowledgePointId || !title) {
    return NextResponse.json({ error: "缺少知识点信息" }, { status: 400 })
  }

  const difficulty = level === "进阶" || level === "高阶" ? level : "入门"

  // Verify ownership
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: true } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const contextInfo = [courseTitle, moduleTitle].filter(Boolean).join(" > ")

  const levelPrompt = difficulty === "入门"
    ? `## 入门难度 — 输出规范
目标读者：对该领域有基础认知，但完全不了解本知识点的人。

📖 概念讲解
用大白话解释"是什么"和"为什么需要它"。必须用一个生活中的场景做类比（比如"就像..."）。不引入术语，如有术语必须先解释再使用。控制在 200 字内。

💻 代码示例
给出最简可运行示例（≤20 行），每行关键代码后面用中文注释解释这行在做什么。运行结果用注释标出。

🎯 本节要点
列出 3 条核心要点

❓ 自我检测
2 道判断题或填空题，考察"是否理解了基本概念"。每题附答案。`
    : difficulty === "进阶"
    ? `## 进阶难度 — 输出规范
目标读者：已经用过或了解本知识点基本概念的人。

📖 深入理解
对比本知识点与同类方案的区别（至少一个对比项），说明各自的适用场景和取舍。控制在 300 字内。

💻 代码示例
给出接近生产环境的代码（≤30 行），包含边界处理或配置选项。必须标注关键参数的含义。

⚠️ 常见误区
写出 1-2 个典型误解，每个用"❌ 误区→✅ 正确"格式纠正。

🎯 本节要点
列出 4-5 条要点，包含使用建议和注意事项

❓ 自我检测
2 道应用题，要求写出代码片段或方案。每题附参考答案。`
    : `## 高阶难度 — 输出规范
目标读者：已熟练掌握本知识点的开发者。

📖 原理剖析
讲解底层实现机制或设计思想。如果有源码可以参考，引用关键逻辑（伪代码即可）。控制在 400 字内。

💻 代码示例
展示一个该知识点在极端场景下的表现（如大数据量、高并发、边界条件），包含性能分析或调优参数。≤40 行。

⚠️ 深入陷阱
写出 2-3 个容易被忽略的深坑，每个说明触发条件和规避方案。

🎯 本节要点
列出 5 条，侧重架构决策、性能优化和设计模式

❓ 自我检测
2 道综合题，要求设计一个包含该知识点的完整方案。每题附参考答案。`

  const prompt = `你是课程讲师。为以下知识点生成${difficulty}难度的学习内容。

课程领域：${contextInfo || "未指定"}
知识点：${title}

领域约束：所有术语、代码、对比必须使用"${contextInfo || "未指定"}"领域的真实工具链和场景。如果标题可能跨领域，根据课程上下文先明确界定所属领域。

${levelPrompt}

直接输出 Markdown，不要用代码块包裹整体内容。`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: difficulty === "高阶" ? 3500 : difficulty === "进阶" ? 2800 : 2000,
    })

    const content = result.choices?.[0]?.message?.content ?? ""

    if (!content || content.trim().length < 20) {
      return NextResponse.json({ error: "AI 返回内容不足" }, { status: 500 })
    }

    // Save to DB
    await prisma.knowledgePoint.update({
      where: { id: knowledgePointId },
      data: { content },
    })

    return NextResponse.json({ content, message: "内容已生成" })
  } catch (error) {
    console.error("enrich-content error:", error)
    return NextResponse.json({ error: "内容生成失败" }, { status: 500 })
  }
}
