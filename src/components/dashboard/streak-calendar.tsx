"use client"

import { useEffect, useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DayData {
  date: string
  studyMinutes: number
  studySeconds: number
  kpsCompleted: number
  cardsReviewed: number
  notesCreated: number
}

function getIntensity(day: DayData): string {
  const total = day.studyMinutes + Math.ceil((day.studySeconds || 0) / 60)
  if (total === 0) return "bg-muted"
  if (total <= 15) return "bg-emerald-200 dark:bg-emerald-900"
  if (total <= 30) return "bg-emerald-300 dark:bg-emerald-700"
  if (total <= 60) return "bg-emerald-400 dark:bg-emerald-600"
  if (total <= 120) return "bg-emerald-500 dark:bg-emerald-500"
  return "bg-emerald-600 dark:bg-emerald-400"
}

export function StreakCalendar() {
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/activity/calendar?months=6")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border p-4">
        <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-sm bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dataMap = new Map<string, DayData>()
  for (const d of data) dataMap.set(d.date, d)

  // Generate 26 weeks grid starting from Monday
  const start = new Date(today)
  start.setDate(start.getDate() - 26 * 7)
  const dayOfWeek = start.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  start.setDate(start.getDate() + mondayOffset)

  const weeks: { date: Date; data: DayData | undefined }[][] = []
  for (let w = 0; w < 26; w++) {
    const week: { date: Date; data: DayData | undefined }[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(date.getDate() + w * 7 + d)
      const dateStr = date.toISOString().split("T")[0]
      week.push({ date: new Date(date), data: dataMap.get(dateStr) })
    }
    weeks.push(week)
  }

  // Month labels
  const monthLabels: { label: string; col: number }[] = []
  for (let w = 0; w < weeks.length; w++) {
    const m = weeks[w][0].date.getMonth()
    if (w === 0 || m !== weeks[w - 1][0].date.getMonth()) {
      monthLabels.push({ label: `${m + 1}月`, col: w })
    }
  }

  const weekDayLabels = ["一", "二", "三", "四", "五", "六", "日"]

  return (
    <TooltipProvider delay={200}>
      <div className="rounded-xl border p-4">
        <h4 className="text-sm font-medium mb-3">学习打卡日历</h4>

        <div className="flex ml-8 mb-1">
          {monthLabels.map((ml, i) => (
            <div
              key={i}
              className="text-[10px] text-muted-foreground"
              style={{ marginLeft: i === 0 ? ml.col * 14 : (ml.col - monthLabels[i - 1].col) * 14 }}
            >
              {ml.label}
            </div>
          ))}
        </div>

        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-1">
            {weekDayLabels.map((label, i) => (
              <div key={i} className="text-[10px] text-muted-foreground h-3.5 w-5 flex items-center justify-end">
                {i % 2 === 0 ? label : ""}
              </div>
            ))}
          </div>

          <div className="flex gap-0.5 overflow-x-auto">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => {
                  const isFuture = day.date > today
                  const mins = day.data?.studyMinutes ?? 0
                  const dateStr = `${day.date.getMonth() + 1}/${day.date.getDate()}`
                  return (
                    <Tooltip key={di}>
                      <TooltipTrigger>
                        <div
                          className={`w-3.5 h-3.5 rounded-sm ${
                            isFuture ? "bg-transparent border border-muted" : getIntensity(day.data || { studyMinutes: 0, studySeconds: 0, kpsCompleted: 0, cardsReviewed: 0, notesCreated: 0, date: "" })
                          }`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-medium">{dateStr}</p>
                        {day.data ? (
                          <>
                            <p>学习 {day.data.studyMinutes} 分钟</p>
                            <p>掌握 {day.data.kpsCompleted} 个知识点</p>
                            {day.data.cardsReviewed > 0 && <p>复习 {day.data.cardsReviewed} 张卡片</p>}
                          </>
                        ) : isFuture ? (
                          <p className="text-muted-foreground">未来</p>
                        ) : (
                          <p className="text-muted-foreground">无学习记录</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
          <span>少</span>
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
          <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-700" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-600" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-400" />
          <span>多</span>
        </div>
      </div>
    </TooltipProvider>
  )
}
