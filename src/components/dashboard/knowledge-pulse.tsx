"use client"

import { useMemo } from "react"
import { Zap, TrendingUp, Sparkles } from "lucide-react"

interface PulseProps {
  studyMinutes: number
  notesCreated: number
  aiConversations: number
  streak: number
  kpReviewed: number
}

/** "Forge Pulse" — MindForge's signature visual element.
 *  Shows today's cognitive rhythm as a breathing, glowing organism.
 *  The warmer the glow, the deeper your learning flow state. */
export function KnowledgePulse({ studyMinutes, notesCreated, aiConversations, streak, kpReviewed }: PulseProps) {
  const totalActions = notesCreated + aiConversations + kpReviewed

  // Intensity: 0 (silent) → 4 (flow state)
  const intensity = useMemo(() => {
    if (totalActions === 0 && studyMinutes === 0) return 0
    if (totalActions <= 2 && studyMinutes < 15) return 1
    if (totalActions <= 5 && studyMinutes < 30) return 2
    if (totalActions <= 10 && studyMinutes < 60) return 3
    return 4
  }, [totalActions, studyMinutes])

  const labels = ["静默中", "微光", "活跃", "专注", "心流"]
  const label = labels[intensity]

  const ringColors = [
    "border-muted-foreground/15",
    "border-blue-300/40 dark:border-blue-700/40",
    "border-primary/50 dark:border-primary/50",
    "border-primary/70 dark:border-primary/60",
    "border-[var(--copper)]/70 dark:border-[var(--copper)]/60",
  ]

  const dotColors = [
    "bg-muted-foreground/25",
    "bg-blue-400",
    "bg-primary",
    "bg-primary",
    "bg-[var(--copper)]",
  ]

  const isFlowing = intensity >= 3

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 h-full flex flex-col justify-between">
      {/* Ambient background glow during flow */}
      {isFlowing && (
        <>
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-bl from-[var(--copper)]/15 to-transparent rounded-full blur-2xl pointer-events-none animate-pulse" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-tr from-primary/12 to-transparent rounded-full blur-2xl pointer-events-none" style={{ animationDelay: "1s" }} />
        </>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${intensity >= 3 ? "bg-[var(--copper)]/10" : "bg-primary/10"}`}>
            <Sparkles className={`h-3.5 w-3.5 ${intensity >= 3 ? "text-[var(--copper)]" : "text-primary"}`} />
          </div>
          <span className="text-sm font-semibold">知识脉动</span>
          {streak > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto">
              🔥 {streak}天
            </span>
          )}
        </div>

        {/* Pulse Ring — the visual centerpiece */}
        <div className="flex justify-center mb-4">
          <div className={`relative flex items-center justify-center w-20 h-20 rounded-full border-2 ${ringColors[intensity]} transition-colors duration-700`}>
            <div
              className={`w-4 h-4 rounded-full ${dotColors[intensity]} transition-colors duration-700 ${isFlowing ? "animate-[breathe_2s_ease-in-out_infinite]" : ""}`}
            />

            {/* Ambient rings during flow state */}
            {isFlowing && (
              <>
                <div className={`absolute inset-0 rounded-full border-2 ${ringColors[intensity]} animate-ping opacity-25`}
                  style={{ animationDuration: "3s" }} />
                <div className={`absolute -inset-2 rounded-full border ${ringColors[intensity]} animate-pulse opacity-15`}
                  style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
                <div className={`absolute -inset-4 rounded-full border ${ringColors[intensity]} opacity-8`}
                  style={{ animation: "forge-glow 3s ease-in-out infinite", animationDelay: "1s" }} />
              </>
            )}

            {intensity >= 1 && !isFlowing && (
              <div className={`absolute inset-0 rounded-full ${dotColors[intensity]} opacity-10 blur-md`} />
            )}
          </div>
        </div>

        {/* State label */}
        <div className="text-center mb-4">
          <p className={`text-lg font-bold ${intensity >= 3 ? "text-[var(--copper)]" : "text-foreground"}`}>
            {label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {intensity === 0 ? "等待你的第一次学习" :
             intensity === 1 ? "慢慢来，保持节奏" :
             intensity === 2 ? "不错的进展" :
             intensity === 3 ? "你正在深度专注中" :
             "极致的学习状态 ✨"}
          </p>
        </div>
      </div>

      {/* Stats meters */}
      <div className="space-y-2.5">
        {[
          { label: "学习时长", value: studyMinutes, unit: "分钟", color: "bg-green-400", pct: Math.min(studyMinutes / 120 * 100, 100) },
          { label: "知识点复习", value: kpReviewed, unit: "个", color: "bg-primary", pct: Math.min(kpReviewed / 20 * 100, 100) },
          { label: "笔记+AI", value: notesCreated + aiConversations, unit: "次", color: "bg-purple-400", pct: Math.min((notesCreated + aiConversations) / 10 * 100, 100) },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2.5">
            <span className="w-16 text-[11px] text-muted-foreground shrink-0">{stat.label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${stat.color} transition-all duration-700`}
                style={{ width: `${stat.pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium tabular-nums w-14 text-right shrink-0">
              {stat.value > 0 ? stat.value : "--"}
              {stat.value > 0 && <span className="text-muted-foreground font-normal ml-0.5">{stat.unit}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Intensity meter */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-5 h-1 rounded-full transition-all duration-500 ${
                i <= intensity
                  ? i >= 4 ? "bg-[var(--copper)]" : i >= 2 ? "bg-primary" : "bg-blue-400"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {totalActions > 0 ? `${totalActions} 次活动` : "今日未开始"}
        </span>
      </div>
    </div>
  )
}
