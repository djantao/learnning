"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CalendarClock, Target, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface GoalSchedulePanelProps {
  goalId: string
  courseId: string | null
  courseTitle: string | null
  currentTargetDate: string | null
  progressPct: number
}

export function GoalSchedulePanel({
  goalId,
  courseId,
  courseTitle,
  currentTargetDate,
  progressPct,
}: GoalSchedulePanelProps) {
  const [targetDate, setTargetDate] = useState(currentTargetDate?.split("T")[0] ?? "")
  const [loading, setLoading] = useState(false)
  const [requirement, setRequirement] = useState<{
    dailyKpsNeeded: number | null
    dailyMinutesNeeded: number | null
    feasible: boolean | null
    totalRemaining: number
    daysLeft: number
  } | null>(null)

  useEffect(() => {
    if (!courseId) return
    fetch(`/api/goals/${goalId}/schedule`)
      .then((r) => r.json())
      .then(setRequirement)
      .catch(() => {})
  }, [goalId, courseId])

  async function applySchedule() {
    if (!targetDate) {
      toast.error("请选择目标日期")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`排期已更新！每日 ${data.dailyMinutes} 分钟`)
        const reqRes = await fetch(`/api/goals/${goalId}/schedule`)
        setRequirement(await reqRes.json())
      } else {
        toast.error(data.message || "排期失败")
      }
    } catch {
      toast.error("排期失败")
    }
    setLoading(false)
  }

  if (!courseId || !courseTitle) {
    return (
      <div className="rounded-lg border p-4 text-center">
        <p className="text-sm text-muted-foreground">关联课程后即可设置学习目标</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-medium">学习目标排期</h4>
        <Badge variant="secondary" className="text-[10px]">{courseTitle}</Badge>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>当前进度</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="h-8 text-sm"
          min={new Date().toISOString().split("T")[0]}
        />
        <Button size="sm" onClick={applySchedule} disabled={loading || !targetDate}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "应用排期"}
        </Button>
      </div>

      {requirement && requirement.daysLeft > 0 && (
        <div className={`rounded-lg p-3 text-sm ${
          requirement.feasible
            ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
            : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {requirement.feasible ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="font-medium">
              {requirement.feasible ? "计划可行" : "目标可能过紧"}
            </span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>剩余 <strong>{requirement.daysLeft}</strong> 天 / <strong>{requirement.totalRemaining}</strong> 个知识点</p>
            <p>每日需掌握 <strong>{requirement.dailyKpsNeeded}</strong> 个知识点</p>
            <p>每日需学习 <strong>{requirement.dailyMinutesNeeded}</strong> 分钟</p>
          </div>
        </div>
      )}

      {requirement && requirement.daysLeft === 0 && (
        <div className="rounded-lg p-3 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="font-medium text-red-600 dark:text-red-400">目标日期已过，请重新设置</span>
          </div>
        </div>
      )}
    </div>
  )
}
