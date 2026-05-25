import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await params
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { userId: true } }, mindMap: true },
  })
  if (!mod || mod.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(mod)
}

async function verifyOwnership(moduleId: string, userId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { userId: true } } },
  })
  return mod?.course.userId === userId ? mod : null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await params
  const owner = await verifyOwnership(moduleId, session.user.id)
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const mod = await prisma.module.update({ where: { id: moduleId }, data: await req.json() })
  return NextResponse.json(mod)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await params
  const owner = await verifyOwnership(moduleId, session.user.id)
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.module.delete({ where: { id: moduleId } })
  return NextResponse.json({ success: true })
}
