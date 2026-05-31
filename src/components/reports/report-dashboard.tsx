"use client"

import { useEffect, useState } from "react"
import { StatsGrid } from "@/components/reports/stats-grid"
import { SimpleBarChart } from "@/components/reports/simple-bar-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lightbulb, Loader2 } from "lucide-react"

export function ReportDashboard() {
  const [type, setType] = useState<"weekly" | "monthly">("weekly")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?type=${type}`)
      .then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [type])

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!data) return null

  const stats = [
    { label: "学习时长", value: `${data.stats.totalStudyMinutes} 分钟` },
    { label: "掌握知识点", value: data.stats.totalKpsCompleted },
    { label: "活跃天数", value: data.stats.activeDays },
    { label: "复习卡片", value: data.stats.totalCardsReviewed },
    { label: "笔记", value: data.stats.totalNotes },
    { label: "练习均分", value: data.stats.avgScore !== null ? `${data.stats.avgScore}/5` : "--" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant={type === "weekly" ? "default" : "outline"} size="sm" onClick={() => setType("weekly")}>周报</Button>
        <Button variant={type === "monthly" ? "default" : "outline"} size="sm" onClick={() => setType("monthly")}>月报</Button>
        <Badge variant="outline" className="text-xs">{data.periodStart} ~ {data.periodEnd}</Badge>
      </div>
      <StatsGrid stats={stats} />
      {data.dailyBreakdown.length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">每日学习时长（分钟）</h4>
          <SimpleBarChart data={data.dailyBreakdown.map((d: any) => ({ label: d.date, value: d.studyMinutes }))} />
        </div>
      )}
      <div className="rounded-lg border p-4 bg-primary/5">
        <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-yellow-500" />AI 学习建议
        </h4>
        <ul className="space-y-2">
          {data.suggestions.map((s: string, i: number) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-primary shrink-0 mt-1">•</span>{s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
