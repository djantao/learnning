import { auth } from "@/lib/auth"
import { getReviewOverview } from "@/lib/review"
import { ReviewDashboard } from "@/components/review/review-dashboard"

export default async function ReviewPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const overview = await getReviewOverview(session.user.id)
  return <ReviewDashboard overview={overview} />
}
