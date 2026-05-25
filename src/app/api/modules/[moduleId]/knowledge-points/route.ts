import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

async function verifyModuleOwnership(moduleId: string, userId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { userId: true } } },
  })
  return mod?.course.userId === userId
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await params
  if (!(await verifyModuleOwnership(moduleId, session.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const kps = await prisma.knowledgePoint.findMany({
    where: { moduleId },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(kps)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await params
  if (!(await verifyModuleOwnership(moduleId, session.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const { title, content, sortOrder } = body as {
    title: string; content?: string; sortOrder?: number
  }
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })

  const kp = await prisma.knowledgePoint.create({
    data: { moduleId, title, content, sortOrder },
  })

  return NextResponse.json(kp, { status: 201 })
}
