import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { anchors } = await req.json() as { anchors: { id?: string; title: string; instruction: string; category: string; priority: number; isActive: boolean }[] }

  // Delete removed anchors and upsert all
  const existingIds = anchors.filter((a) => a.id).map((a) => a.id!)
  await prisma.instructionAnchor.deleteMany({
    where: { userId: session.user.id, id: { notIn: existingIds } },
  })

  // Upsert each anchor
  const results = await Promise.all(
    anchors.map((anchor, index) => {
      if (anchor.id) {
        return prisma.instructionAnchor.update({
          where: { id: anchor.id },
          data: {
            title: anchor.title,
            instruction: anchor.instruction,
            category: anchor.category,
            priority: index,
            isActive: anchor.isActive,
          },
        })
      }
      return prisma.instructionAnchor.create({
        data: {
          userId: session.user.id,
          title: anchor.title,
          instruction: anchor.instruction,
          category: anchor.category,
          priority: index,
          isActive: anchor.isActive,
        },
      })
    })
  )

  return NextResponse.json(results)
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const anchors = await prisma.instructionAnchor.findMany({
    where: { userId: session.user.id },
    orderBy: { priority: "desc" },
  })

  return NextResponse.json(anchors)
}
