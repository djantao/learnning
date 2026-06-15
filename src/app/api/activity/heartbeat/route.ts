import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const studySeconds = typeof body.studySeconds === "number" ? Math.max(0, body.studySeconds) : 0

    const today = new Date(new Date().toDateString())

    const existing = await prisma.dailyActivity.findUnique({
      where: { userId_date: { userId: session.user.id, date: today } },
    })

    if (existing) {
      const newStudySeconds = existing.studySeconds + studySeconds
      await prisma.dailyActivity.update({
        where: { userId_date: { userId: session.user.id, date: today } },
        data: {
          studySeconds: newStudySeconds,
          studyMinutes: Math.max(existing.studyMinutes, Math.ceil(newStudySeconds / 60)),
        },
      })
    } else {
      await prisma.dailyActivity.create({
        data: {
          userId: session.user.id,
          date: today,
          studySeconds,
          studyMinutes: studySeconds > 0 ? Math.ceil(studySeconds / 60) : 1,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
