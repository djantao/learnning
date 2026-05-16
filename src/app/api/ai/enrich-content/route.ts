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

  const prompt = `你是课程讲师。为以下知识点生成学习内容。

课程领域：${contextInfo || "未指定"}
知识点：${title}
难度：${difficulty}

## 领域约束
知识点属于"${contextInfo || "未指定"}"领域。所有术语解释、类比、代码必须使用该领域的工具链和真实场景。如果标题可能跨领域（如 FE、State、Driver），根据课程上下文判定含义，概念讲解第一句先明确界定。

## 内容篇幅
- 概念讲解：2-3 段，总计不超过 300 字
- 代码示例：完整可运行，不超过 30 行，含必要的 import 和预期输出说明
- 常见误区：0-3 条。仅在该知识点存在典型误解时写；没有则不写此节
- 本节要点：3-5 条，每条一句话
- 自我检测：2 道题，每题附参考答案或解题思路

## 难度控制
- 入门：用生活类比降低门槛，代码给最小可用示例
- 进阶：可对比同类概念，代码接近生产场景
- 高阶：深入原理或源码细节，代码覆盖边界情况

## 输出结构
直接输出以下 Markdown（不要用代码块包裹整体内容）：

📖 概念讲解
...

💻 代码示例
...

⚠️ 常见误区
（没有则省略此节）

🎯 本节要点
- ...

❓ 自我检测
问题1：...
参考答案：...

问题2：...
参考答案：...`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: 2500,
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
