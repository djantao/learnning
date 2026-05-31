import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { KpReviewQueue } from "@/components/review/kp-review-queue"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain } from "lucide-react"

export default async function KpReviewPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const [dueCount, totalInRotation] = await Promise.all([
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, mastery: { gte: 4 }, sm2NextReview: { lte: new Date() } },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, sm2Repetitions: { gt: 0 } },
    }),
  ])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6 text-primary" />知识点复习</h2>
        <p className="text-muted-foreground mt-1">间隔重复帮你巩固已掌握的知识点</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">待复习</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{dueCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">复习中</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalInRotation}</p></CardContent></Card>
      </div>
      <KpReviewQueue />
    </div>
  )
}
