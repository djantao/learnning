import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { xpToLevel } from "@/lib/gamification"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { xp: true, level: true },
  })

  return NextResponse.json({ xp: user?.xp ?? 0, level: user?.level ?? 1 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { addXp } = await req.json()
  if (typeof addXp !== "number" || addXp <= 0) {
    return NextResponse.json({ error: "Missing addXp" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { xp: true },
  })

  const currentXp = (user?.xp ?? 0) + addXp
  const newLevel = xpToLevel(currentXp)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { xp: currentXp, level: newLevel },
  })

  return NextResponse.json({ xp: currentXp, level: newLevel })
}

/** 首次迁移：将 localStorage 的 XP 同步到数据库 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { xp: clientXp } = await req.json()
  if (typeof clientXp !== "number") {
    return NextResponse.json({ error: "Missing xp" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { xp: true },
  })

  // 取较大值，避免覆盖已有数据库数据
  const finalXp = Math.max(user?.xp ?? 0, clientXp)
  const level = xpToLevel(finalXp)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { xp: finalXp, level },
  })

  return NextResponse.json({ xp: finalXp, level })
}
