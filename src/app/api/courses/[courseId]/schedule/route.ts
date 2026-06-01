import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { scheduleCourse } from "@/lib/schedule"
import { adaptSchedule } from "@/lib/adaptive-schedule"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId } = await params
  const { dailyStudyMinutes, weeklySchedule, adaptive, skipCompleted } = await req.json()

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  try {
    // 自适应排期模式：检测偏差 → 自动重排
    if (adaptive) {
      const result = await adaptSchedule(session.user.id, courseId)
      return NextResponse.json(result)
    }

    // 保存弹性节奏配置（如果提供）
    if (weeklySchedule) {
      await prisma.course.update({
        where: { id: courseId },
        data: { weeklySchedule },
      })
    }

    const mins = dailyStudyMinutes ?? course.dailyStudyMinutes ?? 120
    if (mins < 10) {
      return NextResponse.json({ error: "每日学习时长至少10分钟" }, { status: 400 })
    }

    const result = await scheduleCourse(session.user.id, courseId, mins, undefined, !!skipCompleted)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("schedule error:", error)
    return NextResponse.json({ error: "排期失败", detail: error?.message || String(error) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId } = await params
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  // findMany + 逐个更新（Neon HTTP 不支持 updateMany）
  const modules = await prisma.module.findMany({
    where: { courseId, scheduledDate: { not: null } },
    select: { id: true },
  })

  await Promise.all(
    modules.map((m) =>
      prisma.module.update({
        where: { id: m.id },
        data: { scheduledDate: null },
      })
    )
  )

  return NextResponse.json({ cleared: modules.length })
}
