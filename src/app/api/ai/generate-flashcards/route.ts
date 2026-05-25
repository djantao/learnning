import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { noteId } = body

  const note = await prisma.page.findFirst({ where: { id: noteId, userId: session.user.id } })
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 })

  const prompt = `Based on the following note content, generate 5-10 flashcards for spaced repetition review.
Each flashcard should have a question (front) and detailed answer (back).
Output as JSON array with "front" and "back" fields.

Note title: ${note.title}
Note content:
${note.contentPlain.slice(0, 4000)}

Generate flashcards in this exact JSON format:
[{"front": "Question?", "back": "Detailed answer..."}]`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: 2000,
    })

    const text = result.choices?.[0]?.message?.content ?? "[]"
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const flashcards = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    // Save flashcards
    const created = await Promise.all(
      flashcards.map((card: { front: string; back: string }) =>
        prisma.flashcard.create({
          data: {
            userId: session.user.id,
            pageId: noteId,
            front: card.front,
            back: card.back,
            sourceType: "ai_generated",
            sm2NextReview: new Date(),
          },
        })
      )
    )

    return NextResponse.json({ flashcards: created, count: created.length })
  } catch (error) {
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 })
  }
}
