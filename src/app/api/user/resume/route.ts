import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { resumeCourseId: true, resumeKpId: true, resumeUpdatedAt: true },
  })

  if (!user?.resumeCourseId || !user?.resumeKpId) {
    return NextResponse.json(null)
  }

  const [course, kp] = await Promise.all([
    prisma.course.findUnique({ where: { id: user.resumeCourseId }, select: { id: true, title: true, icon: true, color: true } }),
    prisma.knowledgePoint.findUnique({ where: { id: user.resumeKpId }, select: { id: true, title: true, moduleId: true } }),
  ])

  if (!course || !kp) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    courseId: course.id,
    courseTitle: course.title,
    courseIcon: course.icon,
    courseColor: course.color,
    kpId: kp.id,
    kpTitle: kp.title,
    moduleId: kp.moduleId,
    updatedAt: user.resumeUpdatedAt,
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId, kpId } = await req.json()

  if (!courseId || !kpId) {
    return NextResponse.json({ error: "courseId and kpId required" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      resumeCourseId: courseId,
      resumeKpId: kpId,
      resumeUpdatedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
