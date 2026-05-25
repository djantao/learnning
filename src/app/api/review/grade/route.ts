import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sm2, type Grade, type SM2State } from "@/lib/sm2"
import { recomputeGoalsForPage } from "@/lib/goals"
import { trackActivity } from "@/lib/activity"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { cardId, grade, sessionId, responseTimeMs } = body as {
    cardId: string
    grade: Grade
    sessionId: string
    responseTimeMs?: number
  }

  const card = await prisma.flashcard.findFirst({
    where: { id: cardId, userId: session.user.id },
  })

  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 })

  // Run SM-2 algorithm
  const prevState: SM2State = {
    interval: card.sm2Interval,
    repetitions: card.sm2Repetitions,
    efactor: card.sm2Efactor,
    nextReview: card.sm2NextReview,
  }

  const nextState = sm2(prevState, grade)

  // Update card
  const updatedCard = await prisma.flashcard.update({
    where: { id: cardId },
    data: {
      sm2Interval: nextState.interval,
      sm2Repetitions: nextState.repetitions,
      sm2Efactor: nextState.efactor,
      sm2NextReview: nextState.nextReview,
    },
  })

  // Record review log
  await prisma.reviewLog.create({
    data: {
      sessionId,
      flashcardId: cardId,
      grade,
      intervalBefore: prevState.interval,
      intervalAfter: nextState.interval,
      efactorBefore: prevState.efactor,
      efactorAfter: nextState.efactor,
      repetitionsBefore: prevState.repetitions,
      responseTimeMs: responseTimeMs ?? null,
    },
  })

  // Update session count
  await prisma.reviewSession.update({
    where: { id: sessionId },
    data: { cardsReviewed: { increment: 1 } },
  })

  // Track daily activity
  const wasMastered = prevState.interval >= 21
  const isNowMastered = nextState.interval >= 21
  trackActivity(session.user.id, {
    cardsReviewed: 1,
    studyMinutes: 1,
    ...(isNowMastered && !wasMastered ? { cardsMastered: 1 } : {}),
  }).catch(() => {})

  // Recompute goal progress for goals linked to this card's page
  if (card.pageId) {
    recomputeGoalsForPage(card.pageId).catch(() => {})
  }

  return NextResponse.json(updatedCard)
}
