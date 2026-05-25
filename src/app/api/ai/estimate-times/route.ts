import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId } = await req.json()
  if (!courseId) return NextResponse.json({ error: "缺少课程ID" }, { status: 400 })

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const allModules = await prisma.module.findMany({
    where: { courseId },
    include: {
      childModules: { select: { id: true, title: true, estimatedMinutes: true } },
      knowledgePoints: { select: { id: true } },
    },
  })

  const needsEstimate = allModules.filter((m) => m.estimatedMinutes == null)

  if (needsEstimate.length === 0) {
    return NextResponse.json({ message: "所有模块已有预估时长", count: 0 })
  }

  const moduleList = needsEstimate.map((m) =>
    `- ${m.title}（${m.knowledgePoints.length} 个知识点）`
  ).join("\n")

  const prompt = `你是课程时长评估专家。请为以下模块估算学习时长（分钟）。

课程：${course.title}

模块列表：
${moduleList}

规则：
- 简单概念模块（1-2个知识点）：10-20分钟
- 中等模块（3-4个知识点）：20-40分钟
- 复杂模块（5+个知识点）：40-60分钟
- 实践/项目模块：额外加10-20分钟

输出纯 JSON 对象（不要markdown代码块），key是模块标题，value是分钟数（整数）：
{"模块标题1": 30, "模块标题2": 45, ...}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 返回格式异常", raw: text.slice(0, 200) }, { status: 500 })
    }

    let estimates: Record<string, number>
    try { estimates = JSON.parse(jsonMatch[0]) } catch {
      return NextResponse.json({ error: "JSON 解析失败", raw: text.slice(0, 200) }, { status: 500 })
    }

    let updated = 0
    let fallback = 0
    for (const mod of needsEstimate) {
      const minutes = estimates[mod.title]
      if (typeof minutes === "number" && minutes > 0) {
        await prisma.module.update({
          where: { id: mod.id },
          data: { estimatedMinutes: Math.round(minutes) },
        })
        updated++
      } else {
        const fb = Math.max(10, mod.knowledgePoints.length * 15)
        await prisma.module.update({
          where: { id: mod.id },
          data: { estimatedMinutes: fb },
        })
        fallback++
      }
    }

    return NextResponse.json({ message: `已为 ${updated} 个模块设置时长${fallback > 0 ? `，${fallback} 个按KP数推算` : ""}`, count: updated + fallback })
  } catch (error) {
    console.error("estimate-times error:", error)
    return NextResponse.json({ error: "估算失败" }, { status: 500 })
  }
}
