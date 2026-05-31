import { auth } from "@/lib/auth"
import { WeakPointList } from "@/components/analysis/weak-point-list"
import { AlertTriangle } from "lucide-react"

export default async function AnalysisPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-orange-500" />薄弱点分析</h2>
        <p className="text-muted-foreground mt-1">聚合练习、测验和掌握度数据，定位知识薄弱环节</p>
      </div>
      <WeakPointList />
    </div>
  )
}
