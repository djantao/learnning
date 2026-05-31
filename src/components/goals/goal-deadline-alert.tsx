"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface GoalDeadlineAlertProps {
  goalId: string
  title: string
  targetDate: string
  progressPct: number
  daysLeft: number
  requiredDailyKps: number
}

export function GoalDeadlineAlert({
  goalId,
  title,
  targetDate,
  progressPct,
  daysLeft,
  requiredDailyKps,
}: GoalDeadlineAlertProps) {
  if (daysLeft > 14) return null

  const isCritical = daysLeft <= 3
  // Rough estimate: what progress should be at this point
  const totalDuration = 365
  const expectedProgress = Math.max(0, ((totalDuration - daysLeft) / totalDuration) * 100)
  const isBehind = progressPct < expectedProgress - 15

  if (!isBehind && !isCritical) return null

  return (
    <div
      className={`rounded-lg border p-3 ${
        isCritical
          ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
          isCritical ? "text-red-500" : "text-amber-500"
        }`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            isCritical ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
          }`}>
            {isCritical ? "目标即将到期！" : "学习进度可能落后"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            「{title}」还剩 <strong>{daysLeft}</strong> 天，当前进度 <strong>{Math.round(progressPct)}%</strong>
          </p>
          {isBehind && (
            <p className="text-xs text-muted-foreground mt-0.5">
              建议每日掌握 <strong>{requiredDailyKps}</strong> 个知识点以跟上计划
            </p>
          )}
          <Link href={`/goals/${goalId}`}>
            <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
              查看详情
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
