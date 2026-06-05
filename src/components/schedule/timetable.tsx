"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight, Clock, GraduationCap, AlertTriangle, CheckCircle2, X } from "lucide-react"
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
  const [rebalance, setRebalance] = useState<{ moved: number; details: { moduleId: string; title: string; courseTitle: string; scheduledDate: string; overdueDays: number }[] } | null>(null)
  const [showOverdueBanner, setShowOverdueBanner] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/schedules?days=28")
      .then((r) => r.json())
      .then((data) => {
        setModules(data.modules || [])
        if (data.rebalance?.moved > 0) {
          setRebalance(data.rebalance)
          setShowOverdueBanner(true)
        }
      })
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

  function calcOverdueDays(m: ScheduledModule): number {
    if (!m.scheduledDate || m.status === "completed") return 0
    const d = new Date(m.scheduledDate)
    const t = new Date(today)
    if (d >= t) return 0
    return Math.ceil((t.getTime() - d.getTime()) / 86400000)
  }

  function statusBadge(m: ScheduledModule) {
    const overdueDays = calcOverdueDays(m)
    if (m.status === "completed") {
      return <Badge className="bg-green-500 hover:bg-green-600 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />已完成</Badge>
    }
    if (overdueDays > 0) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />逾期 {overdueDays} 天</Badge>
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

      {/* Overdue Rebalance Banner */}
      {rebalance && showOverdueBanner && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <CardContent className="flex items-start justify-between py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  排期逾期调整 — {rebalance.moved} 个模块已自动移至明天
                </p>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1 space-y-0.5">
                  {rebalance.details.slice(0, 5).map((d) => (
                    <p key={d.moduleId}>
                      {d.courseTitle} &gt; {d.title}
                      <span className="font-semibold ml-1">（逾期 {d.overdueDays} 天）</span>
                    </p>
                  ))}
                  {rebalance.details.length > 5 && (
                    <p className="text-muted-foreground">... 还有 {rebalance.details.length - 5} 个</p>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setShowOverdueBanner(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-muted-foreground">加载中...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: 7-column grid (unchanged) */}
          <div className="hidden lg:grid grid-cols-7 gap-3">
            {weekDays.map((d, i) => (
              <div key={i} className={`text-center py-2 rounded-md ${isToday(d) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <p className="text-xs font-medium">{DAY_LABELS[i]}</p>
                <p className="text-lg font-bold">{d.getDate()}</p>
                <p className="text-[10px] opacity-70">{d.getMonth() + 1}月</p>
              </div>
            ))}
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
                      {dayModules.map((m) => {
                        const oDays = calcOverdueDays(m)
                        const isOverdue = oDays > 0
                        const isDone = m.status === "completed"
                        return (
                        <Link key={m.id} href={`/courses/${m.course.id}`}>
                          <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${
                            isOverdue ? "border-red-400 dark:border-red-600 bg-red-50/50 dark:bg-red-950/20" :
                            isDone ? "opacity-60 border-green-300 dark:border-green-800" : ""
                          }`}>
                            <CardContent className="py-2 px-2.5 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{m.course.icon}</span>
                                <span className="text-[11px] font-medium truncate" title={m.course.title}>{m.course.title}</span>
                              </div>
                              <p className="text-xs truncate text-muted-foreground" title={m.title}>{m.title}</p>
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
                      )})}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Mobile: stacked day cards */}
          <div className="lg:hidden space-y-3">
            {weekDays.map((d, i) => {
              const key = formatDate(d)
              const dayModules = byDate[key] || []
              const dayTotal = dayModules.reduce((s, m) => s + (m.estimatedMinutes || 0), 0)
              const dayCompleted = dayModules.filter(m => m.status === "completed").length
              const today = isToday(d)
              return (
                <div key={i} className={`rounded-xl border ${today ? "border-primary/30 bg-primary/5" : "border-muted bg-card"} p-3 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium w-5 text-center ${today ? "text-primary font-bold" : "text-muted-foreground"}`}>{DAY_LABELS[i]}</span>
                      <span className={`text-sm font-bold ${today ? "text-primary" : ""}`}>{d.getDate()}日</span>
                      <span className="text-xs text-muted-foreground">{d.getMonth() + 1}月</span>
                      {today && <Badge className="text-[10px]">今天</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {dayModules.length > 0 ? (
                        <>
                          <span>{dayCompleted}/{dayModules.length} 完成</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{formatMinutes(dayTotal)}</span>
                        </>
                      ) : (
                        <span>无安排</span>
                      )}
                    </div>
                  </div>
                  {dayModules.length > 0 && (
                    <div className="grid gap-1.5">
                      {dayModules.map((m) => {
                        const oDays = calcOverdueDays(m)
                        return (
                          <Link key={m.id} href={`/courses/${m.course.id}`}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors active:bg-muted ${
                              oDays > 0 ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20" :
                              m.status === "completed" ? "opacity-60 border-green-300 dark:border-green-800" :
                              "hover:border-primary/50"
                            }`}>
                            <span className="text-sm shrink-0">{m.course.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{m.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{m.course.title}</p>
                            </div>
                            <div className="shrink-0">{statusBadge(m)}</div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
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
