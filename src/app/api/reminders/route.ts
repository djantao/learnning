import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const reminders = await prisma.reminder.findMany({
    where: { userId: session.user.id, isRead: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, title: true, message: true, link: true, createdAt: true },
  })

  return NextResponse.json({ reminders, unreadCount: reminders.length })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { type, title, message, link } = await req.json()
  if (!type || !title || !message) {
    return NextResponse.json({ error: "缺少必要字段" }, { status: 400 })
  }

  const reminder = await prisma.reminder.create({
    data: { userId: session.user.id, type, title, message, link: link || null },
  })

  return NextResponse.json({ reminder }, { status: 201 })
}
