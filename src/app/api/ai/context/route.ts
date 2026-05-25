import { auth } from "@/lib/auth"
import { buildContext } from "@/lib/ai/context-builder"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const topicNoteId = searchParams.get("noteId") ?? undefined

  const context = await buildContext({ userId: session.user.id, topicNoteId })

  return NextResponse.json({ systemPrompt: context.systemPrompt })
}
