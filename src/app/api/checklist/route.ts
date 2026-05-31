import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const modules = await prisma.module.findMany({
    where: {
      course: { userId: session.user.id },
      scheduledDate: { gte: today, lt: tomorrow },
      status: { not: "completed" },
    },
    include: {
      course: { select: { id: true, title: true, icon: true, color: true } },
    },
    orderBy: { sortOrder: "asc" },
  })

  const items = modules.map((m) => {
    const isChecked = m.checkedAt != null && new Date(m.checkedAt) >= today
    return {
      moduleId: m.id,
      title: m.title,
      courseId: m.course.id,
      courseTitle: m.course.title,
      courseIcon: m.course.icon,
      courseColor: m.course.color,
      estimatedMinutes: m.estimatedMinutes,
      status: m.status,
      progressPct: m.progressPct,
      checked: isChecked,
    }
  })

  return NextResponse.json(items)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId, checked } = await req.json()

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId required" }, { status: 400 })
  }

  const mod = await prisma.module.findFirst({
    where: { id: moduleId, course: { userId: session.user.id } },
    select: { id: true },
  })
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.module.update({
    where: { id: moduleId },
    data: {
      checkedAt: checked ? new Date() : null,
    },
  })

  return NextResponse.json({ ok: true })
}
