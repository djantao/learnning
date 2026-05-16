import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const records = await prisma.practiceRecord.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      knowledgePoint: {
        select: { id: true, title: true, module: { select: { id: true, title: true, course: { select: { id: true, title: true } } } } },
      },
    },
  })

  type WrongEntry = {
    recordId: string
    question: string
    userAnswer: string
    correctAnswer: string
    explanation: string
    createdAt: string
  }

  type KPGroup = {
    kpId: string
    kpTitle: string
    wrongEntries: WrongEntry[]
  }

  const courses: Record<string, {
    courseId: string; courseTitle: string
    modules: Record<string, {
      moduleId: string; moduleTitle: string
      knowledgePoints: Record<string, KPGroup>
    }>
  }> = {}

  for (const r of records) {
    let results: { isCorrect: boolean; correctAnswer: string; explanation: string }[] = []
    try { results = JSON.parse(r.questionResults ?? "[]") } catch { continue }

    let questions: string[] = []
    try { questions = JSON.parse(r.questions) } catch { continue }

    let userAnswers: string[] = []
    try { userAnswers = JSON.parse(r.userAnswers) } catch { continue }

    const wrongIndices: number[] = []
    results.forEach((res, i) => { if (!res.isCorrect) wrongIndices.push(i) })

    if (wrongIndices.length === 0) continue

    const kp = r.knowledgePoint
    const mod = kp.module
    const course = mod.course

    if (!courses[course.id]) {
      courses[course.id] = { courseId: course.id, courseTitle: course.title, modules: {} }
    }
    if (!courses[course.id].modules[mod.id]) {
      courses[course.id].modules[mod.id] = { moduleId: mod.id, moduleTitle: mod.title, knowledgePoints: {} }
    }
    if (!courses[course.id].modules[mod.id].knowledgePoints[kp.id]) {
      courses[course.id].modules[mod.id].knowledgePoints[kp.id] = { kpId: kp.id, kpTitle: kp.title, wrongEntries: [] }
    }

    for (const i of wrongIndices) {
      courses[course.id].modules[mod.id].knowledgePoints[kp.id].wrongEntries.push({
        recordId: r.id,
        question: questions[i] ?? "",
        userAnswer: userAnswers[i] ?? "",
        correctAnswer: results[i]?.correctAnswer ?? "",
        explanation: results[i]?.explanation ?? "",
        createdAt: r.createdAt.toISOString(),
      })
    }
  }

  const courseList = Object.values(courses).map((c) => ({
    courseId: c.courseId,
    courseTitle: c.courseTitle,
    modules: Object.values(c.modules).map((m) => ({
      moduleId: m.moduleId,
      moduleTitle: m.moduleTitle,
      knowledgePoints: Object.values(m.knowledgePoints).map((kp) => ({
        kpId: kp.kpId,
        kpTitle: kp.kpTitle,
        wrongCount: kp.wrongEntries.length,
        entries: kp.wrongEntries,
      })),
    })),
  }))

  return NextResponse.json({ courses: courseList })
}
