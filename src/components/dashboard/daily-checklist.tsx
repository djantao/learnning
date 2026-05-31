"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Clock, Play, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface ChecklistItem {
  moduleId: string
  title: string
  courseId: string
  courseTitle: string
  courseIcon: string
  courseColor: string
  estimatedMinutes: number | null
  status: string
  progressPct: number
  checked: boolean
}

function formatMinutes(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const min = m % 60
    return min > 0 ? `${h}h${min}m` : `${h}h`
  }
  return `${m}m`
}

export function DailyChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/checklist")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleCheck(item: ChecklistItem) {
    setItems((prev) =>
      prev.map((i) => (i.moduleId === item.moduleId ? { ...i, checked: !i.checked } : i))
    )
    try {
      await fetch("/api/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: item.moduleId, checked: !item.checked }),
      })
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.moduleId === item.moduleId ? { ...i, checked: item.checked } : i))
      )
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border p-4">
        <div className="h-4 w-20 bg-muted rounded animate-pulse mb-3" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse mb-2" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/50 mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">今日暂无学习安排</p>
        <Link href="/courses">
          <Button variant="outline" size="sm" className="mt-2">去排课</Button>
        </Link>
      </div>
    )
  }

  const checkedCount = items.filter((i) => i.checked).length
  const totalMinutes = items.reduce((s, i) => s + (i.estimatedMinutes ?? 0), 0)

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">今日学习清单</h4>
        <Badge variant="secondary" className="text-[10px]">
          {checkedCount}/{items.length} 已完成
        </Badge>
      </div>

      <Progress value={items.length > 0 ? (checkedCount / items.length) * 100 : 0} className="h-1.5 mb-3" />

      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.moduleId}
            className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/50 ${
              item.checked ? "opacity-60" : ""
            }`}
          >
            <Checkbox
              checked={item.checked}
              onCheckedChange={() => toggleCheck(item)}
              className="shrink-0"
            />
            <div
              className="shrink-0 h-7 w-7 rounded flex items-center justify-center text-xs"
              style={{ backgroundColor: `${item.courseColor}20`, color: item.courseColor }}
            >
              {item.courseIcon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${item.checked ? "line-through text-muted-foreground" : "font-medium"}`}>
                {item.title}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {item.courseTitle}
                {item.estimatedMinutes && (
                  <span className="ml-1.5">· {formatMinutes(item.estimatedMinutes)}</span>
                )}
              </p>
            </div>
            {item.checked ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <Link href={`/courses/${item.courseId}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0">
                  <Play className="h-3 w-3" />
                  开始
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>

      {totalMinutes > 0 && (
        <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t">
          预计总时长：{formatMinutes(totalMinutes)}
        </p>
      )}
    </div>
  )
}
