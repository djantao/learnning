import { auth } from "@/lib/auth"
import { ReportDashboard } from "@/components/reports/report-dashboard"
import { BarChart3 } from "lucide-react"

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" />学习报告</h2>
        <p className="text-muted-foreground mt-1">查看你的学习统计和 AI 建议</p>
      </div>
      <ReportDashboard />
    </div>
  )
}
