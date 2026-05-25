import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { knowledgePointId, mode } = body as { knowledgePointId: string; mode?: "flashcard" | "conversation" }

  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: { select: { userId: true } } } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const weakSiblings = await prisma.knowledgePoint.findMany({
    where: { moduleId: kp.moduleId, id: { not: knowledgePointId }, mastery: { lt: 3 } },
    select: { title: true, mastery: true },
    take: 5,
  })

  const isFlashcard = mode === "flashcard"
  const format = isFlashcard
    ? "Generate 5 flashcards. Return as JSON array: [{\"front\": \"Question?\", \"back\": \"Answer\"}]"
    : "Generate 3 Feynman-style review questions. Each should ask the user to explain concepts in their own words, compare related concepts, or apply to scenarios."

  const weakHint = weakSiblings.length > 0
    ? `\nRelated weak areas: ${weakSiblings.map((w) => `"${w.title}" (${w.mastery}/5)`).join(", ")}. Connect these when relevant.`
    : ""

  const prompt = `Based on this knowledge point, generate review content.

Knowledge point: ${kp.title}
Content: ${getContentPlain(kp.content).slice(0, 3000) || "(no content — use the title)"}
${weakHint}

${format}
${isFlashcard ? "" : "Include a brief evaluation rubric for each question."}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      maxTokens: isFlashcard ? 2000 : 1500,
    })

    const text = result.choices?.[0]?.message?.content ?? ""

    if (isFlashcard) {
      const m = text.match(/\[[\s\S]*\]/)
      const cards = m ? JSON.parse(m[0]) : []
      return NextResponse.json({ flashcards: cards, count: cards.length })
    }

    return NextResponse.json({ questions: text, mode: "conversation" })
  } catch {
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 })
  }
}
