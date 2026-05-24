import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { quizGenPrompt } from "@/lib/ai/skills/quiz-generator"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await params

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: { select: { id: true, title: true, userId: true } },
      knowledgePoints: { select: { id: true, title: true, content: true }, orderBy: { sortOrder: "asc" } },
      childModules: { select: { id: true } },
    },
  })
  if (!mod || mod.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 递归收集所有 KP
  async function collectKPs(modId: string): Promise<{ id: string; title: string; content: string }[]> {
    const m = await prisma.module.findUniqueOrThrow({
      where: { id: modId },
      include: {
        knowledgePoints: { select: { id: true, title: true, content: true }, orderBy: { sortOrder: "asc" } },
        childModules: { select: { id: true } },
      },
    })
    const kps = m.knowledgePoints.filter((k) => k.content && k.content.trim().length > 0)
    for (const child of m.childModules) {
      kps.push(...(await collectKPs(child.id)))
    }
    return kps
  }

  const allKPs = await collectKPs(moduleId)
  if (allKPs.length === 0) {
    return NextResponse.json({ error: "该模块没有已生成内容的知识点" }, { status: 400 })
  }

  const prompt = quizGenPrompt({
    moduleTitle: mod.title,
    courseTitle: mod.course.title,
    kpContents: allKPs,
  })

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: 3000,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: "AI 生成题目失败" }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])
    const questions = parsed.questions || []

    const quiz = await prisma.moduleQuiz.create({
      data: {
        moduleId,
        userId: session.user.id,
        questions: JSON.stringify(questions),
      },
    })

    return NextResponse.json({ quizId: quiz.id, questions, totalQuestions: questions.length })
  } catch (error: any) {
    console.error("quiz gen error:", error)
    return NextResponse.json({ error: "测验生成失败", detail: error?.message || String(error) }, { status: 500 })
  }
}
