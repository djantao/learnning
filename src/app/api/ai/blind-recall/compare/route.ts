import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { recallId, knowledgePointId } = (await req.json()) as { recallId: string; knowledgePointId: string }
  const [recall, kp] = await Promise.all([
    prisma.blindRecall.findFirst({ where: { id: recallId, userId: session.user.id } }),
    prisma.knowledgePoint.findUnique({ where: { id: knowledgePointId } }),
  ])
  if (!recall || !kp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const kpContent = kp.content?.replace(/<!--[\s\S]*?-->/g, "").replace(/[#*`>|\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000) || kp.title

  const prompt = `Compare a student's blind recall against the source material.

Knowledge Point: "${kp.title}"
Source content: ${kpContent}

Student's recall (FROM MEMORY):
"""
${recall.userRecall.slice(0, 3000)}
"""

Output ONLY valid JSON (no markdown):
{
  "accuracy": 0.0-1.0,
  "strengths": ["correctly recalled concept", ...],
  "gaps": ["important missed or wrong concept", ...],
  "missedConcepts": ["key-term-1", ...],
  "suggestion": "1-2 sentence study tip in Chinese"
}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3, maxTokens: 1200, task: "evaluate_answers",
    })
    const text = result.choices?.[0]?.message?.content ?? "{}"
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}")
    const comparison = { accuracy: json.accuracy ?? 0.5, strengths: json.strengths ?? [], gaps: json.gaps ?? [], missedConcepts: json.missedConcepts ?? [], suggestion: json.suggestion ?? "" }

    await prisma.blindRecall.update({
      where: { id: recallId },
      data: { aiComparison: JSON.stringify(comparison), recallScore: comparison.accuracy },
    })

    const today = new Date(new Date().toDateString()) as any
    await prisma.dailyActivity.upsert({
      where: { userId_date: { userId: session.user.id, date: today } },
      create: { userId: session.user.id, date: today, blindRecalls: 1 },
      update: { blindRecalls: { increment: 1 } },
    })

    return NextResponse.json({ id: recallId, recallScore: comparison.accuracy, aiComparison: comparison })
  } catch (e) {
    console.error("blind-recall compare:", e)
    return NextResponse.json({ error: "Comparison failed" }, { status: 500 })
  }
}
