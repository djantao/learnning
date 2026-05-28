import { auth } from "@/lib/auth"
import { getUpcomingModules, rebalanceSchedule } from "@/lib/schedule"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get("days") || "14", 10)

  // 并行执行：重排期和获取模块同时进行，不互相阻塞
  const [rebalance, modules] = await Promise.all([
    rebalanceSchedule(session.user.id),
    getUpcomingModules(session.user.id, Math.min(days, 60)),
  ])

  const grouped: Record<string, typeof modules> = {}
  for (const m of modules) {
    if (!m.scheduledDate) continue
    const key = m.scheduledDate.toISOString().slice(0, 10)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }

  return NextResponse.json({ modules, grouped, rebalance })
}
