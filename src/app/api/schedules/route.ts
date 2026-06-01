import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUpcomingModules, rebalanceSchedule } from "@/lib/schedule"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get("days") || "14", 10)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const pastStart = new Date(today)
  pastStart.setDate(pastStart.getDate() - 30)

  // 串行执行；rebalance 可能因 Neon 限制失败，不允许阻断页面
  let rebalance = { moved: 0, details: [] as any[] }
  try {
    rebalance = await rebalanceSchedule(session.user.id)
  } catch { /* Neon transactions not supported — skip rebalance */ }
  const upcoming = await getUpcomingModules(session.user.id, Math.min(days, 60))
  const pastModules = await prisma.module.findMany({
    where: {
      course: { userId: session.user.id },
      scheduledDate: { gte: pastStart, lt: today },
    },
    select: {
      id: true, title: true, status: true, progressPct: true,
      estimatedMinutes: true, scheduledDate: true, sortOrder: true,
      course: { select: { id: true, title: true, icon: true, color: true } },
      parentModule: { select: { id: true, title: true } },
    },
    orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
  })

  // 合并去重
  const seen = new Set<string>()
  const modules = [...pastModules, ...upcoming].filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  }).sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())

  const grouped: Record<string, typeof modules> = {}
  for (const m of modules) {
    if (!m.scheduledDate) continue
    const key = m.scheduledDate.toISOString().slice(0, 10)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }

  return NextResponse.json({ modules, grouped, rebalance })
}
