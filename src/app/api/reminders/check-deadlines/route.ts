import { NextResponse } from "next/server"
import { checkProjectDeadlines, checkOverdueSchedules } from "@/lib/reminder-check"

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    await Promise.all([checkProjectDeadlines(userId), checkOverdueSchedules(userId)])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Check failed" }, { status: 500 })
  }
}
