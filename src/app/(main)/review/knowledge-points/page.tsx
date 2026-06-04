import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { KpReviewQueue } from "@/components/review/kp-review-queue"
import { KpReviewForecast } from "@/components/review/kp-review-forecast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, TrendingUp, AlertTriangle } from "lucide-react"

export default async function KpReviewPage({ searchParams }: { searchParams: Promise<{ focus?: string; cram?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return null
  const sp = await searchParams
  const focus = sp.focus
  const cram = sp.cram === "true"
  const now = new Date()

  const [dueCount, totalInRotation, overdueCount] = await Promise.all([
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, mastery: { gte: 4 }, sm2NextReview: { lte: now } },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, sm2Repetitions: { gt: 0 } },
    }),
    prisma.knowledgePoint.count({
      where: { module: { course: { userId: session.user.id } }, mastery: { gte: 4 }, sm2NextReview: { lt: now } },
    }),
  ])

  const isFocusMode = focus === "weak"
  const isCramMode = cram

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          知识点复习
          {isFocusMode && <span className="text-sm font-normal text-orange-500">· 薄弱点模式</span>}
          {isCramMode && <span className="text-sm font-normal text-red-500">· 突击模式</span>}
        </h2>
        <p className="text-muted-foreground mt-1">
          {isFocusMode ? "集中攻克掌握度低的知识点" :
           isCramMode ? "忽略间隔限制，集中复习所有已掌握知识点" :
           "间隔重复帮你巩固已掌握的知识点"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">待复习</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-500" : ""}`}>{dueCount}</p>
          {overdueCount > 0 && <p className="text-[11px] text-red-500/80 mt-0.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{overdueCount} 个逾期</p>}
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">复习中</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalInRotation}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" />本周</CardTitle></CardHeader>
          <CardContent><KpReviewForecast /></CardContent></Card>
      </div>

      <KpReviewQueue focus={isFocusMode} cram={isCramMode} />
    </div>
  )
}
