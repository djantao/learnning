import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notebooks = await prisma.notebook.findMany({
    where: { userId: session.user.id },
    include: {
      sections: {
        include: { pages: { select: { id: true, title: true, slug: true, updatedAt: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(notebooks)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const notebook = await prisma.notebook.create({
    data: {
      userId: session.user.id,
      name: body.name,
      description: body.description || "",
      sections: {
        create: {
          name: "默认章节",
          sortOrder: 0,
        },
      },
    },
    include: { sections: true },
  })

  return NextResponse.json(notebook, { status: 201 })
}
