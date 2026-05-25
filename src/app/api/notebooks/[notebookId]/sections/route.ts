import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ notebookId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId } = await params
  const body = await req.json()

  const section = await prisma.section.create({
    data: {
      notebookId,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
    },
  })

  return NextResponse.json(section, { status: 201 })
}
