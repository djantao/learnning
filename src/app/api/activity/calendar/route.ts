import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const months = Math.min(parseInt(searchParams.get("months") || "6"), 12)

  const since = new Date()
  since.setMonth(since.getMonth() - months)
  since.setHours(0, 0, 0, 0)

  const activities = await prisma.dailyActivity.findMany({
    where: {
      userId: session.user.id,
      date: { gte: since },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      studyMinutes: true,
      kpsCompleted: true,
      cardsReviewed: true,
      notesCreated: true,
    },
  })

  const data = activities.map((a) => ({
    date: a.date.toISOString().split("T")[0],
    studyMinutes: a.studyMinutes,
    kpsCompleted: a.kpsCompleted,
    cardsReviewed: a.cardsReviewed,
    notesCreated: a.notesCreated,
  }))

  return NextResponse.json(data)
}
