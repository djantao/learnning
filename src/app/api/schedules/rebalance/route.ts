import { auth } from "@/lib/auth"
import { rebalanceSchedule } from "@/lib/schedule"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const result = await rebalanceSchedule(session.user.id)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("rebalance error:", error)
    return NextResponse.json({ error: "重平衡失败" }, { status: 500 })
  }
}
