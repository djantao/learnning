"use client"

import { useEffect, useState } from "react"

interface ForecastData {
  today: { due: number; done: number; overdue: number }
  weekTotal: number
  maxDay: { date: string; count: number } | null
  forecast: { date: string; count: number }[]
}

export function KpReviewForecast() {
  const [data, setData] = useState<ForecastData | null>(null)

  useEffect(() => {
    fetch("/api/review/knowledge-points/forecast")
      .then((r) => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return <span className="text-xs text-muted-foreground">加载中...</span>

  const today = new Date().toISOString().split("T")[0]
  const maxCount = Math.max(1, ...data.forecast.map((f) => f.count))
  const maxBarH = 36

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">待复习</span>
        <span className="font-bold">{data.weekTotal}</span>
      </div>
      <div className="flex items-end gap-0.5 h-10">
        {data.forecast.map((f) => {
          const isToday = f.date === today
          const h = Math.max(4, (f.count / maxCount) * maxBarH)
          return (
            <div key={f.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${f.date}: ${f.count} 个`}>
              <span className="text-[9px] text-muted-foreground">{f.count || ""}</span>
              <div
                className={`w-full rounded-t-sm ${isToday ? "bg-primary" : "bg-primary/30"}`}
                style={{ height: h }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-0.5 text-[9px] text-muted-foreground">
        {data.forecast.map((f, i) => (
          <span key={f.date} className="flex-1 text-center">
            {i === 0 ? "今" : new Date(f.date).getDate()}
          </span>
        ))}
      </div>
    </div>
  )
}
