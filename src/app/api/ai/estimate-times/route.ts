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
      knowledgePoints: { select: { id: true, title: true, estimatedMinutes: true } },
    },
  })

  const needsEstimateModules = allModules.filter((m) => m.estimatedMinutes == null)
  const modulesWithKPsToEstimate = allModules.filter((m) =>
    m.knowledgePoints.some((kp) => kp.estimatedMinutes == null)
  )

  if (needsEstimateModules.length === 0 && modulesWithKPsToEstimate.length === 0) {
    return NextResponse.json({ message: "所有模块和知识点已有预估时长", count: 0 })
  }

  const moduleList = modulesWithKPsToEstimate.map((m) => {
    const kpLines = m.knowledgePoints
      .filter((kp) => kp.estimatedMinutes == null)
      .map((kp) => `    - ${kp.title}`)
      .join("\n")
    return `- ${m.title}（${m.knowledgePoints.length} 个知识点）${kpLines ? "\n" + kpLines : ""}`
  }).join("\n")

  const prompt = `你是课程时长评估专家。请为以下模块及其知识点估算学习时长（分钟）。

课程：${course.title}

模块列表：
${moduleList}

规则：
- 简单概念模块（1-2个知识点）：10-20分钟
- 中等模块（3-4个知识点）：20-40分钟
- 复杂模块（5+个知识点）：40-60分钟
- 实践/项目模块：额外加10-20分钟
- 单个简单知识点：5-10分钟
- 单个中等知识点：10-20分钟
- 单个复杂知识点：20-30分钟
- 模块总时长应约等于其下所有知识点时长之和（允许±20%误差）

输出纯 JSON 对象（不要markdown代码块），格式如下：
{"模块标题1": {"minutes": 30, "knowledgePoints": {"知识点标题1": 10, "知识点标题2": 20}}, "模块标题2": {"minutes": 45, "knowledgePoints": {"知识点标题3": 45}}, ...}

注意：所有列出的模块都必须有返回值，即使模块本身已有预估时长，也请返回其知识点的预估时长。`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 2000,
      task: "estimate_times",
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 返回格式异常", raw: text.slice(0, 200) }, { status: 500 })
    }

    let estimates: Record<string, { minutes?: number; knowledgePoints?: Record<string, number> }>
    try { estimates = JSON.parse(jsonMatch[0]) } catch {
      return NextResponse.json({ error: "JSON 解析失败", raw: text.slice(0, 200) }, { status: 500 })
    }

    let updatedModules = 0
    let fallbackModules = 0
    let updatedKPs = 0
    let fallbackKPs = 0

    // 第一步：处理模块估算（仅对 needsEstimateModules 中的模块）
    for (const mod of needsEstimateModules) {
      const modEstimate = estimates[mod.title]
      const moduleMinutes = typeof modEstimate === "object" ? modEstimate?.minutes : undefined

      if (typeof moduleMinutes === "number" && moduleMinutes > 0) {
        await prisma.module.update({
          where: { id: mod.id },
          data: { estimatedMinutes: Math.round(moduleMinutes) },
        })
        updatedModules++
      } else {
        const fb = Math.max(10, mod.knowledgePoints.length * 15)
        await prisma.module.update({
          where: { id: mod.id },
          data: { estimatedMinutes: fb },
        })
        fallbackModules++
      }
    }

    // 第二步：处理知识点估算（对所有有需要估算知识点的模块）
    for (const mod of modulesWithKPsToEstimate) {
      const modEstimate = estimates[mod.title]
      const kpEstimates = typeof modEstimate === "object" ? modEstimate?.knowledgePoints : undefined
      // 获取模块的预估时长（可能已存在或由AI返回）
      const moduleMinutes = mod.estimatedMinutes ??
        (typeof modEstimate === "object" && typeof modEstimate?.minutes === "number" ? modEstimate.minutes : null) ??
        Math.max(10, mod.knowledgePoints.length * 15)

      for (const kp of mod.knowledgePoints) {
        if (kp.estimatedMinutes != null) continue // 已有估算则跳过

        const kpMinutes = kpEstimates?.[kp.title]
        if (typeof kpMinutes === "number" && kpMinutes > 0) {
          await prisma.knowledgePoint.update({
            where: { id: kp.id },
            data: { estimatedMinutes: Math.round(kpMinutes) },
          })
          updatedKPs++
        } else {
          // fallback：按模块时长平均分配给未估算的知识点
          const unestimatedCount = mod.knowledgePoints.filter((k) => k.estimatedMinutes == null).length
          const kpFb = Math.max(5, Math.round(moduleMinutes / Math.max(unestimatedCount, 1)))
          await prisma.knowledgePoint.update({
            where: { id: kp.id },
            data: { estimatedMinutes: kpFb },
          })
          fallbackKPs++
        }
      }
    }

    return NextResponse.json({
      message: `已为 ${updatedModules} 个模块、${updatedKPs} 个知识点设置时长${fallbackModules > 0 || fallbackKPs > 0 ? `，其中 ${fallbackModules} 个模块、${fallbackKPs} 个知识点按默认值推算` : ""}`,
      count: updatedModules + fallbackModules + updatedKPs + fallbackKPs,
    })
  } catch (error) {
    console.error("estimate-times error:", error)
    return NextResponse.json({ error: "估算失败" }, { status: 500 })
  }
}
