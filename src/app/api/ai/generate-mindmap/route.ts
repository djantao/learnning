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
      knowledgePoints: { select: { title: true, content: true }, orderBy: { sortOrder: "asc" } },
    },
  })
  if (!mod || mod.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  if (mod.knowledgePoints.length === 0) {
    return NextResponse.json({ error: "该模块没有知识点" }, { status: 400 })
  }

  const kpTexts = mod.knowledgePoints.map((kp, i) => {
    const clean = getContentPlain(kp.content)
    const snippet = clean.length > 300 ? clean.slice(0, 300) + "..." : clean
    return `${i + 1}. ${kp.title} — ${snippet}`
  }).join("\n")

  const prompt = `你是思维导图生成器。请根据以下知识点内容，提炼出层级化的思维导图结构。

模块：${mod.title}
知识点内容：
${kpTexts}

【输出规则】
1. 层级：根节点=模块名 → 二级=概念分组（2-4个） → 三级=具体知识点
2. AI 自动合并相关内容为一组，命名概括该组主题
3. 每个节点 ≤15 个字
4. 不要编造不存在的内容
5. 输出纯 JSON 对象（不要 markdown 代码块）

【输出格式】
{
  "root": "${mod.title}",
  "children": [
    { "title": "概念分组1", "children": [{ "title": "知识点1" }, { "title": "知识点2" }] }
  ]
}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 1500,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 返回格式异常", raw: text.slice(0, 200) }, { status: 500 })
    }

    let data: any
    try { data = JSON.parse(jsonMatch[0]) } catch {
      return NextResponse.json({ error: "JSON 解析失败", raw: text.slice(0, 200) }, { status: 500 })
    }

    if (!data.root || !data.children) {
      return NextResponse.json({ error: "AI 返回结构不完整" }, { status: 500 })
    }

    const mindmap = await prisma.mindMap.upsert({
      where: { moduleId },
      create: { moduleId, data: JSON.stringify(data) },
      update: { data: JSON.stringify(data) },
    })

    return NextResponse.json({ id: mindmap.id, data, layout: mindmap.layout })
  } catch (error) {
    console.error("generate-mindmap error:", error)
    return NextResponse.json({ error: "生成失败" }, { status: 500 })
  }
}
