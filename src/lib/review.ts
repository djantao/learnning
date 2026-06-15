import { prisma } from "./db"

export interface ReviewOverview {
  dueFlashcards: number
  dueKnowledgePoints: number
  wrongAnswerKps: number
  todayReviewed: { flashcards: number; knowledgePoints: number }
  reviewStreak: number
  recentActivity: { date: string; flashcards: number; knowledgePoints: number }[]
}

export async function getReviewOverview(userId: string): Promise<ReviewOverview> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(todayStart)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const [
    dueFlashcards,
    dueKnowledgePoints,
    practiceRecords,
    todayFlashcardReviews,
    todayKpReviews,
    recentFlashcardLogs,
    recentKpLogs,
  ] = await Promise.all([
    prisma.flashcard.count({
      where: { userId, isSuspended: false, sm2NextReview: { lte: now } },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId } }, mastery: { gte: 4 }, sm2NextReview: { lte: now } },
    }),
    prisma.practiceRecord.findMany({
      where: { userId },
      select: { knowledgePointId: true, questionResults: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.reviewLog.count({
      where: { session: { userId }, createdAt: { gte: todayStart } },
    }),
    prisma.kpReviewLog.count({
      where: { userId, createdAt: { gte: todayStart } },
    }),
    prisma.reviewLog.findMany({
      where: { session: { userId }, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.kpReviewLog.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
  ])

  // Calculate wrong answer KPs (distinct)
  const wrongAnswerKpSet = new Set<string>()
  for (const record of practiceRecords) {
    if (!record.questionResults) continue
    try {
      const results = JSON.parse(record.questionResults)
      if (Array.isArray(results) && results.some((r: any) => !r.isCorrect)) {
        wrongAnswerKpSet.add(record.knowledgePointId)
      }
    } catch { /* ignore malformed JSON */ }
  }

  // Calculate review streak (consecutive days with any review activity)
  const reviewDateSet = new Set<string>()
  for (const log of recentFlashcardLogs) {
    reviewDateSet.add(new Date(log.createdAt).toDateString())
  }
  for (const log of recentKpLogs) {
    reviewDateSet.add(new Date(log.createdAt).toDateString())
  }

  let streak = 0
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(todayStart)
    checkDate.setDate(checkDate.getDate() - i)
    if (reviewDateSet.has(checkDate.toDateString())) {
      streak++
    } else if (i === 0) {
      continue // today may not have reviews yet
    } else {
      break
    }
  }

  // Calculate recent activity (last 7 days)
  const recentActivity: { date: string; flashcards: number; knowledgePoints: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const dayStr = dayStart.toISOString().slice(0, 10)

    const fcCount = recentFlashcardLogs.filter(
      (l) => l.createdAt >= dayStart && l.createdAt < dayEnd,
    ).length
    const kpCount = recentKpLogs.filter(
      (l) => l.createdAt >= dayStart && l.createdAt < dayEnd,
    ).length

    recentActivity.push({ date: dayStr, flashcards: fcCount, knowledgePoints: kpCount })
  }

  return {
    dueFlashcards,
    dueKnowledgePoints,
    wrongAnswerKps: wrongAnswerKpSet.size,
    todayReviewed: { flashcards: todayFlashcardReviews, knowledgePoints: todayKpReviews },
    reviewStreak: streak,
    recentActivity,
  }
}
