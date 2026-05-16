import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { QuestionBank } from "@/components/layout/question-bank"

export default async function QuestionsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

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

  const coursesMap: Record<string, {
    courseId: string; courseTitle: string
    modules: Record<string, {
      moduleId: string; moduleTitle: string
      knowledgePoints: Record<string, { kpId: string; kpTitle: string; wrongEntries: WrongEntry[] }>
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

    if (!coursesMap[course.id]) {
      coursesMap[course.id] = { courseId: course.id, courseTitle: course.title, modules: {} }
    }
    if (!coursesMap[course.id].modules[mod.id]) {
      coursesMap[course.id].modules[mod.id] = { moduleId: mod.id, moduleTitle: mod.title, knowledgePoints: {} }
    }
    if (!coursesMap[course.id].modules[mod.id].knowledgePoints[kp.id]) {
      coursesMap[course.id].modules[mod.id].knowledgePoints[kp.id] = { kpId: kp.id, kpTitle: kp.title, wrongEntries: [] }
    }

    for (const i of wrongIndices) {
      coursesMap[course.id].modules[mod.id].knowledgePoints[kp.id].wrongEntries.push({
        recordId: r.id,
        question: questions[i] ?? "",
        userAnswer: userAnswers[i] ?? "",
        correctAnswer: results[i]?.correctAnswer ?? "",
        explanation: results[i]?.explanation ?? "",
        createdAt: r.createdAt.toISOString(),
      })
    }
  }

  const courses = Object.values(coursesMap).map((c) => ({
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

  return <QuestionBank courses={courses} />
}
