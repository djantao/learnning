import { prisma } from "./db"

export async function trackActivity(
  userId: string,
  fields: {
    cardsReviewed?: number
    cardsNew?: number
    cardsMastered?: number
    notesCreated?: number
    notesEdited?: number
    aiConversations?: number
    studyMinutes?: number
    kpsCompleted?: number
  },
) {
  const today = new Date(new Date().toDateString())

  const existing = await prisma.dailyActivity.findFirst({
    where: { userId, date: today as any },
  })

  if (existing) {
    await prisma.dailyActivity.update({
      where: { id: existing.id },
      data: {
        cardsReviewed: { increment: fields.cardsReviewed ?? 0 },
        cardsNew: { increment: fields.cardsNew ?? 0 },
        cardsMastered: { increment: fields.cardsMastered ?? 0 },
        notesCreated: { increment: fields.notesCreated ?? 0 },
        notesEdited: { increment: fields.notesEdited ?? 0 },
        aiConversations: { increment: fields.aiConversations ?? 0 },
        studyMinutes: { increment: fields.studyMinutes ?? 0 },
        kpsCompleted: { increment: fields.kpsCompleted ?? 0 },
      },
    })
  } else {
    await prisma.dailyActivity.create({
      data: {
        userId,
        date: today as any,
        cardsReviewed: fields.cardsReviewed ?? 0,
        cardsNew: fields.cardsNew ?? 0,
        cardsMastered: fields.cardsMastered ?? 0,
        notesCreated: fields.notesCreated ?? 0,
        notesEdited: fields.notesEdited ?? 0,
        aiConversations: fields.aiConversations ?? 0,
        studyMinutes: fields.studyMinutes ?? 0,
        kpsCompleted: fields.kpsCompleted ?? 0,
      },
    })
  }
}
