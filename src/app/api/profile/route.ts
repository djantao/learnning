import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { learningGoals, knowledgeLevel, preferredStyle, preferences } = body

  const profile = await prisma.learningProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      learningGoals: learningGoals || "",
      knowledgeLevel: knowledgeLevel || "",
      preferredStyle: preferredStyle || "",
      preferences: preferences || "{}",
    },
    update: {
      learningGoals: learningGoals || "",
      knowledgeLevel: knowledgeLevel || "",
      preferredStyle: preferredStyle || "",
      preferences: preferences || "{}",
    },
  })

  return NextResponse.json(profile)
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const profile = await prisma.learningProfile.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json(profile)
}
