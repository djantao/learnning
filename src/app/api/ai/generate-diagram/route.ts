import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { knowledgePointId } = await req.json()
  if (!knowledgePointId) return NextResponse.json({ error: "缺少知识点ID" }, { status: 400 })

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: true } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const contentText = getContentPlain(kp.content, "入门") || getContentPlain(kp.content) || kp.content || ""
  const snippet = contentText.slice(0, 2500)

  const prompt = `你是一个技术图表专家。请根据以下知识点内容，生成一个Mermaid图表帮助理解。

知识点：${kp.title}
所属课程：${kp.module.course.title}

参考内容：
${snippet || "暂无详细内容"}

要求：
1. 根据内容选择合适的图表类型（flowchart流程图、sequenceDiagram时序图、graph层次图、timeline时间线）
2. 图表应该直观展示核心概念之间的关系
3. 节点文本使用中文，简洁明了，每个节点最多8个字
4. 只输出Mermaid语法代码，不要markdown代码块标记（不要\`\`\`），不要任何解释
5. 图表控制在8-15个节点以内

直接输出Mermaid代码：`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 2000,
      stream: false,
    })

    let mermaid = result.choices?.[0]?.message?.content ?? ""
    if (!mermaid || mermaid.trim().length < 10) {
      return NextResponse.json({ error: "AI 返回图表内容不足" }, { status: 500 })
    }

    mermaid = mermaid.replace(/^```mermaid\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim()

    return NextResponse.json({ mermaid })
  } catch (error) {
    console.error("generate-diagram error:", error)
    return NextResponse.json({ error: "图表生成失败" }, { status: 500 })
  }
}
