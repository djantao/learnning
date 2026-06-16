import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { buildContext } from "@/lib/ai/context-builder"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { noteId, noteContent, noteTitle } = body as { noteId: string; noteContent: string; noteTitle: string }

  const note = await prisma.page.findFirst({ where: { id: noteId, userId: session.user.id } })
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 })

  const context = await buildContext({
    userId: session.user.id,
    topicNoteId: noteId,
  })

  const prompt = `Summarize the following note content in 2-3 sentences. Capture the key concepts.
Respond in the same language as the note content.

Note title: ${noteTitle}
Content:
${noteContent.slice(0, 4000)}

Summary:`

  try {
    const result = await chatCompletion({
      messages: [
        { role: "system", content: context.systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 300,
      task: "summarize",
    })

    const summary = result.choices?.[0]?.message?.content ?? ""

    await prisma.page.update({
      where: { id: noteId },
      data: { aiSummary: summary },
    })

    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ error: "AI summarization failed" }, { status: 500 })
  }
}
