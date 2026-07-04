import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { quizEvalPrompt } from "@/lib/ai/skills/quiz-generator"
import { recomputeForKnowledgePoint } from "@/lib/curriculum"
import { trackActivity } from "@/lib/activity"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ moduleId: string; quizId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId, quizId } = await params
  const { answers } = await req.json()

  if (!answers || !Array.isArray(answers)) {
    return NextResponse.json({ error: "请提供答案" }, { status: 400 })
  }

  const quiz = await prisma.moduleQuiz.findUnique({ where: { id: quizId } })
  if (!quiz || quiz.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { title: true } } },
  })
  if (!mod) return NextResponse.json({ error: "模块不存在" }, { status: 404 })

  const questions = JSON.parse(quiz.questions)

  const prompt = quizEvalPrompt({
    moduleTitle: mod.title,
    courseTitle: mod.course.title,
    questions,
    answers,
  })

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 2500,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: "AI 评分失败" }, { status: 500 })

    const evaluation = JSON.parse(jsonMatch[0])
    const details = evaluation.details || []
    const diagnosis = {
      overall: evaluation.overall || "",
      totalKps: evaluation.totalKps || 0,
      strong: evaluation.strong || [],
      medium: evaluation.medium || [],
      weak: evaluation.weak || [],
    }

    // 按诊断更新 KP mastery：掌握=5, 熟练=4, 薄弱=2
    let kpsCompletedCount = 0
    for (const item of [...diagnosis.strong, ...diagnosis.medium, ...diagnosis.weak]) {
      const kpId = item.kpId
      if (!kpId) continue
      let newMastery = 3
      if (diagnosis.strong.some((s: any) => s.kpId === kpId)) newMastery = 5
      else if (diagnosis.medium.some((s: any) => s.kpId === kpId)) newMastery = 4
      else if (diagnosis.weak.some((s: any) => s.kpId === kpId)) newMastery = 2

      const kp = await prisma.knowledgePoint.findUnique({
        where: { id: kpId },
        select: { mastery: true, status: true, completedAt: true },
      })
      if (kp && newMastery > kp.mastery) {
        await prisma.knowledgePoint.update({
          where: { id: kpId },
          data: {
            mastery: newMastery,
            status: newMastery >= 4 ? "mastered" : "in_progress",
            completedAt: newMastery >= 4 && !kp.completedAt ? new Date() : undefined,
          },
        })
        await recomputeForKnowledgePoint(kpId)
        if (newMastery >= 4 && kp.status !== "mastered") {
          kpsCompletedCount++
        }
      }
    }

    if (kpsCompletedCount > 0) {
      trackActivity(session.user.id, { kpsCompleted: kpsCompletedCount, studyMinutes: kpsCompletedCount * 5 }).catch(() => {})
    }

    await prisma.moduleQuiz.update({
      where: { id: quizId },
      data: {
        answers: JSON.stringify(answers),
        results: JSON.stringify(details),
        diagnosis: JSON.stringify(diagnosis),
        status: "scored",
      },
    })

    return NextResponse.json({ results: details, diagnosis })
  } catch (error: any) {
    console.error("quiz eval error:", error)
    return NextResponse.json({ error: "评分失败", detail: error?.message || String(error) }, { status: 500 })
  }
}
