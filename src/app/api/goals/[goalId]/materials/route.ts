import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recomputeGoalTree } from "@/lib/goals"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const body = await req.json()
  const { pageId, resourceUrl, resourceTitle } = body

  const material = await prisma.goalMaterial.create({
    data: {
      goalId,
      pageId: pageId || null,
      resourceUrl: resourceUrl || null,
      resourceTitle: resourceTitle || null,
    },
  })

  // Recompute after adding material
  recomputeGoalTree(goalId).catch(() => {})

  return NextResponse.json(material, { status: 201 })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const body = await req.json()
  const { materialId, isCompleted } = body

  await prisma.goalMaterial.update({
    where: { id: materialId },
    data: { isCompleted },
  })

  // Recompute after toggling material
  recomputeGoalTree(goalId).catch(() => {})

  return NextResponse.json({ success: true })
}
