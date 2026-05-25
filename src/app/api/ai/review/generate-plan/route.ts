import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 1. Find recently active knowledge points from conversations in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentConvs = await prisma.conversation.findMany({
    where: {
      userId: session.user.id,
      updatedAt: { gte: weekAgo },
      knowledgePointId: { not: null },
    },
    select: { knowledgePointId: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  })
  const convKpIds = [...new Set(recentConvs.map((c) => c.knowledgePointId!))]

  // 2. Find knowledge points with low mastery
  const weakKps = await prisma.knowledgePoint.findMany({
    where: {
      mastery: { lt: 3 },
      module: { course: { userId: session.user.id } },
    },
    select: { id: true, title: true, content: true, mastery: true, module: { select: { title: true, courseId: true } } },
    orderBy: { mastery: "asc" },
    take: 10,
  })

  // 3. Merge: prioritize recently active + weak, dedup, take top 5
  const seen = new Set<string>()
  const targets: { id: string; title: string; content: string; mastery: number; moduleTitle: string; courseId: string }[] = []

  for (const kpId of convKpIds) {
    const wk = weakKps.find((w) => w.id === kpId)
    if (wk && !seen.has(wk.id)) {
      seen.add(wk.id)
      targets.push({ id: wk.id, title: wk.title, content: wk.content, mastery: wk.mastery, moduleTitle: wk.module.title, courseId: wk.module.courseId })
    }
  }
  for (const wk of weakKps) {
    if (!seen.has(wk.id)) {
      seen.add(wk.id)
      targets.push({ id: wk.id, title: wk.title, content: wk.content, mastery: wk.mastery, moduleTitle: wk.module.title, courseId: wk.module.courseId })
    }
  }
  const plan = targets.slice(0, 5)

  if (plan.length === 0) {
    return NextResponse.json({ plan: [], message: "暂无需要复习的内容，继续保持！" })
  }

  // 4. Generate flashcards for each target
  const results: { kpTitle: string; moduleTitle: string; courseId: string; flashcards: { front: string; back: string }[] }[] = []

  for (const kp of plan) {
    try {
      const prompt = `Based on this knowledge point, generate 3-5 review flashcards. Return ONLY a JSON array: [{"front": "Question?", "back": "Brief answer"}]

Knowledge point: ${kp.title}
Content: ${getContentPlain(kp.content).slice(0, 2000) || "(use the title)"}
Current mastery: ${kp.mastery}/5`

      const result = await chatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        maxTokens: 1000,
      })

      const text = result.choices?.[0]?.message?.content ?? ""
      const m = text.match(/\[[\s\S]*\]/)
      const cards: { front: string; back: string }[] = m ? JSON.parse(m[0]) : []

      for (const card of cards) {
        await prisma.flashcard.create({
          data: {
            userId: session.user.id,
            front: card.front,
            back: card.back,
            knowledgePointId: kp.id,
            sourceType: "ai_generated",
          },
        })
      }

      results.push({
        kpTitle: kp.title,
        moduleTitle: kp.moduleTitle,
        courseId: kp.courseId,
        flashcards: cards,
      })
    } catch {
      results.push({ kpTitle: kp.title, moduleTitle: kp.moduleTitle, courseId: kp.courseId, flashcards: [] })
    }
  }

  return NextResponse.json({ plan: results })
}
