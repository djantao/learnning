import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await req.json()
  if (!moduleId) return NextResponse.json({ error: "缺少模块ID" }, { status: 400 })

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: { select: { userId: true, title: true } },
      knowledgePoints: {
        select: { title: true, content: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!mod || mod.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (mod.knowledgePoints.length === 0) {
    return NextResponse.json({ error: "该模块没有知识点" }, { status: 400 })
  }

  const kpContent = mod.knowledgePoints
    .map((kp) => {
      const stripped = getContentPlain(kp.content)
      const snippet = stripped.length > 1500 ? stripped.slice(0, 1500) + "..." : stripped
      return `## ${kp.title}\n\n${snippet}`
    })
    .join("\n\n---\n\n")

  const prompt = `你是一位资深技术编辑，请根据以下学习笔记内容撰写一篇专业的技术文章。

课程：${mod.course.title}
模块：${mod.title}

【学习内容】
${kpContent}

【写作要求】
1. 生成一个吸引人的文章标题（用 # 标题 格式）
2. 开篇用一小段概述本文会覆盖哪些内容和解决什么问题
3. 将学习内容组织成一篇结构清晰的文章，包含：
   - 核心概念梳理
   - 关键技术点详解（结合代码示例或操作步骤）
   - 实际应用场景
   - 最佳实践总结
4. 语言专业但不晦涩，面向同领域的技术读者
5. 结尾做一个简短总结，提炼 3-5 个关键要点

直接输出 Markdown 格式的完整文章（包含标题）。`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: 3500,
      stream: false,
      task: "generate_article",
    })

    const content = result.choices?.[0]?.message?.content ?? ""

    if (!content || content.trim().length < 50) {
      return NextResponse.json({ error: "AI 返回内容不足" }, { status: 500 })
    }

    const titleMatch = content.match(/^# (.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : `${mod.course.title} - ${mod.title} 学习总结`

    return NextResponse.json({ title, content })
  } catch (error) {
    console.error("generate-article error:", error)
    return NextResponse.json({ error: "文章生成失败" }, { status: 500 })
  }
}
