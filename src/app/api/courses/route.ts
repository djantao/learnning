import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { modules: true } } },
  })

  return NextResponse.json(courses)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { title, description, icon, color } = body as {
    title: string; description?: string; icon?: string; color?: string
  }

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })

  const course = await prisma.course.create({
    data: { userId: session.user.id, title, description, icon, color },
  })

  return NextResponse.json(course, { status: 201 })
}
