import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { moduleId } = await params
  const { layout } = await req.json()

  await prisma.mindMap.updateMany({
    where: { moduleId },
    data: { layout },
  })

  return NextResponse.json({ ok: true })
}
