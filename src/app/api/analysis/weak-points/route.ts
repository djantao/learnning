import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [lowMasteryKps, poorPractices, quizDiagnoses] = await Promise.all([
    prisma.knowledgePoint.findMany({
      where: { module: { course: { userId: session.user.id } }, mastery: { gt: 0, lt: 3 } },
      select: { id: true, title: true, mastery: true, module: { select: { id: true, title: true, course: { select: { id: true, title: true, icon: true } } } } },
      orderBy: { mastery: "asc" }, take: 10,
    }),
    prisma.practiceRecord.findMany({
      where: { userId: session.user.id, aiScore: { lt: 3 } },
      select: { id: true, knowledgePointId: true, aiScore: true, knowledgePoint: { select: { id: true, title: true, module: { select: { id: true, title: true, course: { select: { id: true, title: true, icon: true } } } } } } },
      orderBy: { aiScore: "asc" }, take: 10,
    }),
    prisma.moduleQuiz.findMany({
      where: { userId: session.user.id, status: "scored", diagnosis: { not: null } },
      select: { diagnosis: true, createdAt: true },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
  ])

  const items: { type: string; severity: string; kpId?: string; kpTitle?: string; moduleTitle?: string; courseTitle?: string; courseIcon?: string; source: string; detail: string }[] = []

  for (const kp of lowMasteryKps) {
    items.push({
      type: "mastery", severity: kp.mastery <= 1 ? "high" : "medium",
      kpId: kp.id, kpTitle: kp.title, moduleTitle: kp.module.title,
      courseTitle: kp.module.course.title, courseIcon: kp.module.course.icon,
      source: "掌握度", detail: `当前掌握度 ${kp.mastery}/5`,
    })
  }

  for (const p of poorPractices) {
    if (items.some((i) => i.kpId === p.knowledgePointId)) continue
    items.push({
      type: "practice", severity: (p.aiScore ?? 0) <= 1 ? "high" : "medium",
      kpId: p.knowledgePointId, kpTitle: p.knowledgePoint.title,
      moduleTitle: p.knowledgePoint.module.title, courseTitle: p.knowledgePoint.module.course.title,
      courseIcon: p.knowledgePoint.module.course.icon,
      source: "练习", detail: `AI 评分 ${p.aiScore}/5`,
    })
  }

  for (const quiz of quizDiagnoses) {
    try {
      const diag = JSON.parse(quiz.diagnosis || "{}")
      for (const w of (diag.weak || [])) {
        if (items.some((i) => i.kpTitle && (w.kpTitle || w.topic || "").includes(i.kpTitle))) continue
        items.push({ type: "quiz", severity: "high", source: "测验", detail: `${w.reason || ""}${w.suggestion ? ` — ${w.suggestion}` : ""}` })
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({ total: items.length, items, lowMasteryCount: lowMasteryKps.length, poorPracticeCount: poorPractices.length, quizWeakCount: quizDiagnoses.length })
}
