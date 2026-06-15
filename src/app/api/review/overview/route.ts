import { auth } from "@/lib/auth"
import { getReviewOverview } from "@/lib/review"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const overview = await getReviewOverview(session.user.id)
    return NextResponse.json(overview)
  } catch {
    return NextResponse.json(
      { error: "Failed to load review overview" },
      { status: 500 },
    )
  }
}
