import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { enrichPromptV2 } from "@/lib/ai/skills/enrich-content-v2"
import { parseContentLevels, buildContentField, getContentForLevel, hasContentForLevel } from "@/lib/ai/skills/content-levels"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { knowledgePointId, title, moduleTitle, courseTitle, level, regenerate } = body

  if (!knowledgePointId || !title) {
    return NextResponse.json({ error: "缺少知识点信息" }, { status: 400 })
  }

  const difficulty = level === "进阶" || level === "高阶" ? level : "入门"

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: true } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 检查是否已有该难度的缓存
  if (!regenerate && hasContentForLevel(kp.content, difficulty)) {
    const cached = getContentForLevel(kp.content, difficulty)!
    if (cached.length >= 100 && cached.includes("## ")) {
      return NextResponse.json({ content: cached, cached: true, message: "已加载已有内容" })
    }
  }

  const contextInfo = [courseTitle, moduleTitle].filter(Boolean).join(" > ")

  // 给 AI 传入已有内容作为参考（优先用入门级别的已有内容）
  const existingContent = getContentForLevel(kp.content, difficulty) || undefined

  const prompt = enrichPromptV2({
    difficulty,
    kpTitle: title,
    kpContent: existingContent,
    courseTitle: courseTitle || "",
    moduleTitle: moduleTitle || title,
    contextInfo,
  })

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: difficulty === "高阶" ? 0.3 : 0.5,
      topP: difficulty === "高阶" ? 0.7 : undefined,
      maxTokens: difficulty === "高阶" ? 8000 : difficulty === "进阶" ? 4000 : 4000,
      stream: difficulty === "高阶" ? false : true,
      task: "generate_content",
    })

    const content = result.choices?.[0]?.message?.content ?? ""

    if (!content || content.trim().length < 20) {
      return NextResponse.json({ error: "AI 返回内容不足" }, { status: 500 })
    }

    // 合并新旧内容：保留其他难度的已有内容，只更新当前难度
    const allLevels = parseContentLevels(kp.content)
    allLevels[difficulty] = content
    const mergedContent = buildContentField(allLevels)

    await prisma.knowledgePoint.update({
      where: { id: knowledgePointId },
      data: { content: mergedContent },
    })

    return NextResponse.json({ content, message: "内容已生成" })
  } catch (error) {
    console.error("enrich-content error:", error)
    return NextResponse.json({ error: "内容生成失败" }, { status: 500 })
  }
}
