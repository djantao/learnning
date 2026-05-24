"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight, Clock, GraduationCap, AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface ScheduledModule {
  id: string
  title: string
  status: string
  progressPct: number
  estimatedMinutes: number | null
  scheduledDate: string | null
  sortOrder: number
  course: { id: string; title: string; icon: string; color: string }
  parentModule: { id: string; title: string } | null
}

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

function getWeekRange(date: Date): { start: Date; end: Date; label: string } {
  const d = new Date(date)
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  const startLabel = `${start.getMonth() + 1}/${start.getDate()}`
  const endLabel = `${end.getMonth() + 1}/${end.getDate()}`
  return { start, end, label: `${startLabel} - ${endLabel}` }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${m}m` : `${h}h`
  }
  return `${minutes}m`
}

export function Timetable() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [modules, setModules] = useState<ScheduledModule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/schedules?days=28")
      .then((r) => r.json())
      .then((data) => setModules(data.modules || []))
      .finally(() => setLoading(false))
  }, [])

  const weekStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    return getWeekRange(d).start
  }, [weekOffset])

  const weekDays = useMemo(() => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }, [weekStart])

  const weekLabel = getWeekRange(weekStart).label

  const byDate = useMemo(() => {
    const map: Record<string, ScheduledModule[]> = {}
    for (const m of modules) {
      if (!m.scheduledDate) continue
      const key = m.scheduledDate.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(m)
    }
    return map
  }, [modules])

  const today = formatDate(new Date())

  function statusBadge(m: ScheduledModule) {
    const isOverdue = m.scheduledDate && m.scheduledDate < today && m.status !== "completed"
    if (m.status === "completed") {
      return <Badge className="bg-green-500 hover:bg-green-600 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />已完成</Badge>
    }
    if (isOverdue) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />延期</Badge>
    }
    if (m.status === "in_progress") {
      return <Badge variant="secondary" className="text-[10px]">学习中</Badge>
    }
    return <Badge variant="outline" className="text-[10px]">待开始</Badge>
  }

  function isToday(d: Date) {
    return formatDate(d) === today
  }

  return (
    <div className="space-y-4">
      {/* Week Navigator */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          学习排期
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}>今天</Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-muted-foreground">加载中...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {/* Day Headers */}
          {weekDays.map((d, i) => (
            <div key={i} className={`text-center py-2 rounded-md ${isToday(d) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="text-xs font-medium">{DAY_LABELS[i]}</p>
              <p className="text-lg font-bold">{d.getDate()}</p>
              <p className="text-[10px] opacity-70">{d.getMonth() + 1}月</p>
            </div>
          ))}

          {/* Day Columns */}
          {weekDays.map((d, i) => {
            const key = formatDate(d)
            const dayModules = byDate[key] || []
            const dayTotal = dayModules.reduce((s, m) => s + (m.estimatedMinutes || 0), 0)
            const dayCompleted = dayModules.filter(m => m.status === "completed").length

            return (
              <div key={i} className={`min-h-[200px] rounded-lg border ${isToday(d) ? "border-primary bg-primary/5" : "border-muted bg-card"} p-2 space-y-2`}>
                {dayModules.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">无安排</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                      <span>{dayCompleted}/{dayModules.length} 完成</span>
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{formatMinutes(dayTotal)}</span>
                    </div>
                    {dayModules.map((m) => (
                      <Link key={m.id} href={`/courses/${m.course.id}/learn/${m.id}`}>
                        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${m.status === "completed" ? "opacity-60" : ""}`}>
                          <CardContent className="py-2 px-2.5 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{m.course.icon}</span>
                              <span className="text-[11px] font-medium truncate">{m.course.title}</span>
                            </div>
                            <p className="text-xs truncate text-muted-foreground">{m.title}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">
                                {m.estimatedMinutes ? formatMinutes(m.estimatedMinutes) : ""}
                              </span>
                              {statusBadge(m)}
                            </div>
                            {m.status === "in_progress" && (
                              <Progress value={m.progressPct} className="h-1" />
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && modules.length === 0 && weekOffset === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Clock className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">还没有学习排期</p>
            <p className="text-xs mt-1">去课程页面，点击「自动排期」开始规划学习日程</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
