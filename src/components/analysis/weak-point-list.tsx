"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowRight, Target, Play } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface WeakItem {
  type: string; severity: string; kpId?: string; kpTitle?: string
  moduleTitle?: string; courseTitle?: string; courseIcon?: string
  source: string; detail: string
}

export function WeakPointList() {
  const router = useRouter()
  const [data, setData] = useState<{ total: number; items: WeakItem[]; lowMasteryCount: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analysis/weak-points")
      .then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="mt-3 text-muted-foreground">没有检测到薄弱环节</p>
        <p className="text-sm text-muted-foreground/60 mt-1">积累更多练习和测验数据后，系统会帮你分析</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          发现 <strong className="text-foreground">{data.total}</strong> 个薄弱项
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
          onClick={() => router.push("/review/knowledge-points?focus=weak")}>
          <Play className="h-3 w-3" />复习全部薄弱点
        </Button>
      </div>
      {data.items.map((item, i) => (
        <div key={i} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {item.courseIcon && <span>{item.courseIcon}</span>}
                <span className="text-sm font-medium truncate">{item.kpTitle || item.moduleTitle || "未知"}</span>
                <Badge className={`text-[10px] ${item.severity === "high" ? "bg-red-500" : "bg-amber-500"}`}>
                  {item.severity === "high" ? "严重" : "一般"}
                </Badge>
              </div>
              {item.courseTitle && (
                <p className="text-xs text-muted-foreground">{item.courseTitle}{item.moduleTitle ? ` · ${item.moduleTitle}` : ""}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">{item.source}</Badge>
                <span className="text-xs text-muted-foreground truncate">{item.detail}</span>
              </div>
            </div>
            {item.kpId && (
              <Link href={`/review/knowledge-points/${item.kpId}`}>
                <Button variant="secondary" size="sm" className="shrink-0 h-7 text-xs gap-1">
                  复习 <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
