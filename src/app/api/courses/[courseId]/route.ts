import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId } = await params

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: session.user.id },
    include: {
      modules: {
        where: { parentModuleId: null },
        orderBy: { sortOrder: "asc" },
        include: {
          childModules: {
            orderBy: { sortOrder: "asc" },
            include: {
              childModules: {
                orderBy: { sortOrder: "asc" },
                include: { knowledgePoints: { orderBy: { sortOrder: "asc" } } },
              },
              knowledgePoints: { orderBy: { sortOrder: "asc" } },
            },
          },
          knowledgePoints: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  })

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(course)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId } = await params
  const existing = await prisma.course.findFirst({ where: { id: courseId, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const course = await prisma.course.update({ where: { id: courseId }, data: await req.json() })

  return NextResponse.json(course)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId } = await params
  const existing = await prisma.course.findFirst({ where: { id: courseId, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.course.delete({ where: { id: courseId } })

  return NextResponse.json({ success: true })
}
