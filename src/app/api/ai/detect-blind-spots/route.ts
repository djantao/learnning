import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Collect weak areas from recent review logs
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentFailures = await prisma.reviewLog.findMany({
      where: {
        session: { userId: session.user.id },
        grade: { lt: 3 },
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        flashcard: { select: { front: true, back: true, page: { select: { title: true, tags: { include: { tag: true } } } } } },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    })

    if (recentFailures.length < 5) {
      return NextResponse.json({ message: "Not enough review data for analysis", blindSpots: [] })
    }

    // Collect tags from failed cards
    const tagCounts: Record<string, number> = {}
    for (const log of recentFailures) {
      const tags = log.flashcard?.page?.tags?.map((t: any) => t.tag.name) ?? []
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }

    const weakTopics = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic)

    // Get failed card content
    const failedContent = recentFailures
      .slice(0, 10)
      .map((l) => `Q: ${l.flashcard?.front}\nA: ${l.flashcard?.back}`)
      .join("\n\n")

    // Ask AI to analyze blind spots
    const prompt = `Analyze the following review data and identify knowledge blind spots.

Weak topics detected: ${weakTopics.join(", ")}

Recent failed flashcards:
${failedContent.slice(0, 3000)}

Based on this, identify 3-5 specific knowledge blind spots. For each:
- topic: The specific concept
- description: What the user is struggling with
- severity: A number 0.0-1.0 (1.0 = very severe)
- suggestion: What to study to improve

Output as JSON array:
[{"topic": "...", "description": "...", "severity": 0.X, "suggestion": "..."}]`

    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 2000,
    })

    const text = result.choices?.[0]?.message?.content ?? "[]"
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const blindSpots = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    // Resolve old blind spots
    await prisma.blindSpot.updateMany({
      where: { userId: session.user.id, isResolved: false },
      data: { isResolved: true },
    })

    // Save new blind spots
    const created = await Promise.all(
      blindSpots.map((spot: any) =>
        prisma.blindSpot.create({
          data: {
            userId: session.user.id,
            topic: spot.topic,
            description: spot.description || "",
            severity: spot.severity || 0.5,
            suggestion: spot.suggestion || "",
            relatedCardIds: "[]",
            detectedFrom: JSON.stringify(weakTopics),
          },
        }).catch(() => null)
      )
    )

    return NextResponse.json({ blindSpots: created.filter(Boolean), count: created.length })
  } catch {
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 })
  }
}
