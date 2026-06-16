import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { NextResponse } from "next/server"

const LAYER_PROMPTS: Record<number, string> = {
  1: `Condense from "raw notes" (L1) to "bolded key points" (L2).
Bold the key sentences with **...**. Remove filler, keep structure.
Output ONLY the condensed text.`,

  2: `Condense from "key points" (L2) to "core concepts" (L3).
Extract ONLY the most important concepts as bullet points.
Remove examples, keep definitions and principles.
Output ONLY bullet points.`,

  3: `Condense from "core concepts" (L3) to "one-sentence summary" (L4).
Distill into 1-3 sentences capturing the essence.
Output ONLY the summary.`,

  4: `Condense from "summary" (L4) to "flashcard Q&A" (L5).
Generate 3-5 Q&A pairs for spaced repetition.
Format: Q: <question>\nA: <answer>\n\n
Output ONLY the Q&A pairs.`,
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content, currentLayer, noteTitle } = (await req.json()) as {
    content: string; currentLayer: number; noteTitle?: string
  }

  if (!content || !currentLayer || currentLayer < 1 || currentLayer > 4) {
    return NextResponse.json({ error: "Invalid layer" }, { status: 400 })
  }

  const prompt = `${LAYER_PROMPTS[currentLayer]}\n\nTitle: ${noteTitle || "Untitled"}\n\nContent:\n${content.slice(0, 4000)}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: currentLayer >= 4 ? 800 : currentLayer >= 3 ? 400 : 1500,
      task: "summarize",
    })
    const condensed = result.choices?.[0]?.message?.content ?? ""
    return NextResponse.json({ condensed, fromLayer: currentLayer, toLayer: currentLayer + 1 })
  } catch {
    return NextResponse.json({ error: "Condense failed" }, { status: 500 })
  }
}
