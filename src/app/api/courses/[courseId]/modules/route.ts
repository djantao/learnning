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
  const course = await prisma.course.findFirst({ where: { id: courseId, userId: session.user.id } })
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const modules = await prisma.module.findMany({
    where: { courseId, parentModuleId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      childModules: {
        orderBy: { sortOrder: "asc" },
        include: {
          knowledgePoints: { orderBy: { sortOrder: "asc" } },
          childModules: {
            orderBy: { sortOrder: "asc" },
            include: { knowledgePoints: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      knowledgePoints: { orderBy: { sortOrder: "asc" } },
    },
  })

  return NextResponse.json(modules)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { courseId } = await params
  const course = await prisma.course.findFirst({ where: { id: courseId, userId: session.user.id } })
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const { title, description, parentModuleId, sortOrder } = body as {
    title: string; description?: string; parentModuleId?: string; sortOrder?: number
  }
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })

  const mod = await prisma.module.create({
    data: { courseId, title, description, parentModuleId, sortOrder },
  })

  return NextResponse.json(mod, { status: 201 })
}
