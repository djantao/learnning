"use client"

import { useMemo } from "react"
import { Zap, TrendingUp } from "lucide-react"

interface PulseProps {
  studyMinutes: number
  notesCreated: number
  aiConversations: number
  streak: number
  kpReviewed: number
}

/** Compact "knowledge pulse" — a visual signature showing today's cognitive rhythm */
export function KnowledgePulse({ studyMinutes, notesCreated, aiConversations, streak, kpReviewed }: PulseProps) {
  const totalActions = notesCreated + aiConversations + kpReviewed

  // Determine pulse intensity: 0–4 based on total activity
  const intensity = useMemo(() => {
    if (totalActions === 0 && studyMinutes === 0) return 0
    if (totalActions <= 2 && studyMinutes < 15) return 1
    if (totalActions <= 5 && studyMinutes < 30) return 2
    if (totalActions <= 10 && studyMinutes < 60) return 3
    return 4
  }, [totalActions, studyMinutes])

  const label = ["静默中", "微光", "活跃", "专注", "心流"][intensity]
  const ringClass = [
    "border-muted-foreground/20",
    "border-blue-300/40 dark:border-blue-700/40",
    "border-blue-400/60 dark:border-blue-600/60",
    "border-primary/70",
    "border-purple-400/80 dark:border-purple-500/80",
  ][intensity]
  const dotClass = [
    "bg-muted-foreground/30",
    "bg-blue-300",
    "bg-blue-500",
    "bg-primary",
    "bg-purple-500",
  ][intensity]

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        {/* Pulse ring */}
        <div className={`relative flex items-center justify-center w-14 h-14 rounded-full border-2 ${ringClass} shrink-0`}>
          <div className={`w-4 h-4 rounded-full ${dotClass} ${intensity >= 3 ? "animate-pulse" : ""}`} />
          {intensity >= 3 && (
            <>
              <div className={`absolute inset-0 rounded-full border-2 ${ringClass} animate-ping opacity-30`} />
              <div className={`absolute -inset-1 rounded-full border ${ringClass} animate-pulse opacity-20`} />
            </>
          )}
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">{label}</span>
            {streak > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                🔥 {streak}天
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span title="学习时长" className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {studyMinutes}分
            </span>
            <span title="知识点复习" className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
              {kpReviewed}复习
            </span>
            <span title="笔记 + AI" className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
              {notesCreated + aiConversations}创造
            </span>
          </div>
        </div>

        {/* Intensity meter */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-1.5 h-4 rounded-full transition-colors ${
                  i <= intensity
                    ? i >= 3 ? "bg-purple-500" : i >= 1 ? "bg-primary" : "bg-blue-300"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3 inline mr-0.5" />
            {totalActions > 0 ? `${totalActions} 次活动` : "今日未开始"}
          </span>
        </div>
      </div>
    </div>
  )
}
