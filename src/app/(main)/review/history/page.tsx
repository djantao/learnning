"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History, Brain, Clock, Award, Loader2 } from "lucide-react"

interface ReviewSession {
  id: string
  startedAt: string
  endedAt: string | null
  cardsReviewed: number
  gradesDistribution: string | null
  avgGrade: number | null
  totalTimeSeconds: number | null
}

interface Stats {
  totalCards: number
  dueCards: number
  mastered: number
  recentSessions: ReviewSession[]
}

export default function ReviewHistoryPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, sessionsRes] = await Promise.all([
          fetch("/api/review/stats"),
          fetch("/api/review/sessions"),
        ])
        const statsData = await statsRes.json()
        const sessionsData = await sessionsRes.json()

        setStats({
          ...statsData,
          recentSessions: sessionsData.filter((s: ReviewSession) => s.cardsReviewed > 0),
        })
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats || (stats.totalCards === 0 && stats.recentSessions.length === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">复习历史</h2>
          <p className="text-muted-foreground">查看复习记录和统计数据</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">还没有复习记录</p>
            <p className="mt-1 text-xs text-muted-foreground">完成一次闪卡复习后，记录会出现在这里</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sessions = stats.recentSessions

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "-"
    if (seconds < 60) return `${seconds}秒`
    return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  }

  function renderGradeDist(distJson: string | null): React.ReactNode {
    if (!distJson) return null
    try {
      const dist: Record<string, number> = JSON.parse(distJson)
      return (
        <div className="flex gap-1 mt-1">
          {[0, 1, 2, 3, 4, 5].map((grade) => (
            <Badge key={grade} variant={grade >= 4 ? "default" : grade >= 3 ? "outline" : "secondary"} className="text-[10px]">
              {grade}: {dist[String(grade)] || 0}
            </Badge>
          ))}
        </div>
      )
    } catch { return null }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">复习历史</h2>
        <p className="text-muted-foreground">查看复习记录和统计数据</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{stats.totalCards}</div>
              <div className="text-xs text-muted-foreground">总闪卡数</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold">{stats.dueCards}</div>
              <div className="text-xs text-muted-foreground">待复习</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Award className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{stats.mastered}</div>
              <div className="text-xs text-muted-foreground">已掌握</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-semibold">最近复习会话</h3>
      <div className="space-y-3">
        {sessions.map((session) => (
          <Card key={session.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatDate(session.startedAt)}</span>
                    {session.endedAt ? (
                      <Badge variant="outline" className="text-[10px]">已完成</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">进行中</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{session.cardsReviewed} 张卡片</span>
                    {session.avgGrade != null && (
                      <span>平均评分: {session.avgGrade.toFixed(1)}</span>
                    )}
                    <span>{formatDuration(session.totalTimeSeconds)}</span>
                  </div>
                  {renderGradeDist(session.gradesDistribution)}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {session.avgGrade != null ? session.avgGrade.toFixed(1) : "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">均分</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
