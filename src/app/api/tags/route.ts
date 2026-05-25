import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tags = await prisma.tag.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { pages: true } } },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(tags)
}
