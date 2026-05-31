import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { KpReviewCard } from "@/components/review/kp-review-card"

export default async function KpReviewDetailPage({ params }: { params: Promise<{ kpId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return null
  const { kpId } = await params

  const kp = await prisma.knowledgePoint.findFirst({
    where: { id: kpId, module: { course: { userId: session.user.id } } },
    select: {
      id: true, title: true, content: true, mastery: true,
      sm2Interval: true, sm2Repetitions: true, sm2Efactor: true,
      sm2NextReview: true, lastReviewedAt: true,
      module: { select: { id: true, title: true, course: { select: { id: true, title: true, icon: true, color: true } } } },
    },
  })
  if (!kp) notFound()
  return <div className="max-w-2xl mx-auto"><KpReviewCard kp={JSON.parse(JSON.stringify(kp))} /></div>
}
