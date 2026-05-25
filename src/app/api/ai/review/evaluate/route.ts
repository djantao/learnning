import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { recomputeForKnowledgePoint } from "@/lib/curriculum"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { knowledgePointId, question, userAnswer } = body as {
    knowledgePointId: string; question: string; userAnswer: string
  }

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: { select: { userId: true } } } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const prompt = `Evaluate this user answer to a review question.

Knowledge point: ${kp.title}
Question: ${question}
User answer: ${userAnswer}

Grade 0-5 where 0=no understanding, 3=basic, 5=excellent. Respond in Chinese as JSON:
{"grade": 4, "good": "what was correct", "missing": "what to improve", "saveAsFlashcard": false, "followUp": "next question to deepen understanding"}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      maxTokens: 800,
    })

    const text = result.choices?.[0]?.message?.content ?? "{}"
    const m = text.match(/\{[\s\S]*\}/)
    const evaluation = m ? JSON.parse(m[0]) : { grade: 3 }

    if (typeof evaluation.grade === "number") {
      const newMastery = Math.max(0, Math.min(5, Math.round((kp.mastery + evaluation.grade) / 2)))
      await prisma.knowledgePoint.update({
        where: { id: knowledgePointId },
        data: {
          mastery: newMastery,
          status: newMastery >= 4 ? "mastered" : newMastery > 0 ? "in_progress" : "not_started",
        },
      })
      recomputeForKnowledgePoint(knowledgePointId).catch(() => {})
    }

    return NextResponse.json(evaluation)
  } catch {
    return NextResponse.json({ error: "AI evaluation failed" }, { status: 500 })
  }
}
