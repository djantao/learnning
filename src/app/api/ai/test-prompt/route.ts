import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { enrichPromptV2 } from "@/lib/ai/skills/enrich-content-v2"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { knowledgePointId, difficulty } = await req.json()
  if (!knowledgePointId || !difficulty) return NextResponse.json({ error: "缺少参数" }, { status: 400 })

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: {
      module: {
        include: {
          course: { select: { id: true, title: true, userId: true } },
          parentModule: { select: { id: true, title: true } },
        },
      },
    },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const courseTitle = kp.module.course.title
  const moduleTitle = kp.module.parentModule
    ? `${kp.module.parentModule.title} > ${kp.module.title}`
    : kp.module.title

  const contextInfo = [courseTitle, moduleTitle].filter(Boolean).join(" > ")

  const v2Prompt = enrichPromptV2({
    difficulty,
    kpTitle: kp.title,
    kpContent: getContentPlain(kp.content) || undefined,
    courseTitle,
    moduleTitle,
    contextInfo,
  })

  try {
    const v2Result = await chatCompletion({
      messages: [{ role: "user", content: v2Prompt }],
      temperature: difficulty === "高阶" ? 0.3 : 0.5,
      maxTokens: difficulty === "高阶" ? 4000 : difficulty === "进阶" ? 3200 : 2500,
    })

    return NextResponse.json({
      prompt: v2Prompt,
      content: v2Result.choices?.[0]?.message?.content?.slice(0, 3000) ?? "",
    })
  } catch (error) {
    console.error("test-prompt error:", error)
    return NextResponse.json({ error: "生成失败" }, { status: 500 })
  }
}
