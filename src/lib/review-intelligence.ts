import { prisma } from "./db"

export async function detectDifficultKps(userId: string, limit = 10) {
  const recentLogs = await prisma.kpReviewLog.findMany({
    where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    select: { knowledgePointId: true, grade: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  const byKp = new Map<string, { grades: number[]; count: number }>()
  for (const log of recentLogs) {
    const entry = byKp.get(log.knowledgePointId) || { grades: [], count: 0 }
    entry.grades.push(log.grade)
    entry.count++
    byKp.set(log.knowledgePointId, entry)
  }

  const difficultIds: string[] = []
  for (const [kpId, entry] of byKp) {
    if (entry.count < 2) continue
    const avg = entry.grades.reduce((s, g) => s + g, 0) / entry.grades.length
    if (avg < 3) difficultIds.push(kpId)
  }

  if (difficultIds.length === 0) return []

  return prisma.knowledgePoint.findMany({
    where: { id: { in: difficultIds.slice(0, limit) } },
    select: {
      id: true, title: true, mastery: true,
      sm2Interval: true, sm2Repetitions: true, sm2Efactor: true,
      module: { select: { id: true, title: true, course: { select: { id: true, title: true, icon: true, color: true } } } },
    },
    orderBy: { mastery: "asc" },
  })
}

export async function recommendReviewTime(userId: string): Promise<{
  bestHour: number | null; bestLabel: string; confidence: "low" | "medium" | "high"
}> {
  const logs = await prisma.kpReviewLog.findMany({
    where: { userId },
    select: { createdAt: true, grade: true },
    take: 500,
  })

  if (logs.length < 10) return { bestHour: null, bestLabel: "数据不足", confidence: "low" }

  const hourStats = new Map<number, { good: number; total: number }>()
  for (const log of logs) {
    const h = new Date(log.createdAt).getHours()
    const entry = hourStats.get(h) || { good: 0, total: 0 }
    entry.total++
    if (log.grade >= 4) entry.good++
    hourStats.set(h, entry)
  }

  let bestHour = 9
  let bestRatio = 0
  for (const [h, entry] of hourStats) {
    if (entry.total < 3) continue
    if (entry.good / entry.total > bestRatio) {
      bestRatio = entry.good / entry.total
      bestHour = h
    }
  }

  const labels: Record<number, string> = {
    6: "清晨", 7: "早晨", 8: "上午", 9: "上午", 10: "上午",
    13: "午后", 14: "下午", 15: "下午",
    18: "傍晚", 19: "晚上", 20: "晚上", 21: "晚间", 22: "深夜",
  }

  return {
    bestHour,
    bestLabel: labels[bestHour] || `${bestHour}:00`,
    confidence: logs.length > 50 ? "high" : "medium",
  }
}
