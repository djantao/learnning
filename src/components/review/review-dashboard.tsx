"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Brain, Layers, BookX, Flame, TrendingUp, ArrowRight } from "lucide-react"
import { ReviewPlan } from "@/components/review/review-plan"
import Link from "next/link"
import type { ReviewOverview } from "@/lib/review"

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null
  const color = streak >= 7 ? "text-green-500" : streak >= 3 ? "text-orange-500" : "text-red-400"
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
      <Flame className="h-4 w-4" />
      {streak} 天连续
    </span>
  )
}

function MiniActivityChart({ recentActivity }: { recentActivity: ReviewOverview["recentActivity"] }) {
  const maxVal = Math.max(1, ...recentActivity.map((d) => d.flashcards + d.knowledgePoints))
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"]
  return (
    <div className="flex items-end gap-1 h-10">
      {recentActivity.map((day) => {
        const total = day.flashcards + day.knowledgePoints
        const height = Math.max(4, (total / maxVal) * 40)
        const date = new Date(day.date + "T00:00:00")
        const label = dayLabels[date.getDay()]
        return (
          <div
            key={day.date}
            className="flex-1 flex flex-col items-center gap-0.5"
            title={`${day.date}: ${day.flashcards} 卡片, ${day.knowledgePoints} 知识点`}
          >
            <div className="w-full flex flex-col justify-end gap-px" style={{ height: 40 }}>
              {day.knowledgePoints > 0 && (
                <div
                  className="w-full rounded-sm bg-blue-400 dark:bg-blue-500"
                  style={{ height: Math.max(2, (day.knowledgePoints / maxVal) * 40) }}
                />
              )}
              {day.flashcards > 0 && (
                <div
                  className="w-full rounded-sm bg-violet-400 dark:bg-violet-500"
                  style={{ height: Math.max(2, (day.flashcards / maxVal) * 40) }}
                />
              )}
              {total === 0 && <div className="w-full rounded-sm bg-muted" style={{ height: 4 }} />}
            </div>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ReviewDashboard({ overview }: { overview: ReviewOverview }) {
  const totalDue = overview.dueFlashcards + overview.dueKnowledgePoints
  const totalToday = overview.todayReviewed.flashcards + overview.todayReviewed.knowledgePoints
  const hasAnything = totalDue > 0 || overview.wrongAnswerKps > 0

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">复习中心</h2>
        <p className="text-muted-foreground">间隔重复，巩固记忆</p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <StreakBadge streak={overview.reviewStreak} />
        <span className="text-muted-foreground">
          今日已复习{" "}
          <span className="font-medium text-foreground">{overview.todayReviewed.flashcards}</span>{" "}
          张闪卡 ·{" "}
          <span className="font-medium text-foreground">{overview.todayReviewed.knowledgePoints}</span>{" "}
          个知识点
        </span>
      </div>

      {/* Three review type cards */}
      {hasAnything ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Knowledge Point Review */}
          <Card className={overview.dueKnowledgePoints > 0 ? "border-blue-200 dark:border-blue-800" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Brain className="h-8 w-8 text-blue-500" />
                {overview.dueKnowledgePoints > 0 && (
                  <Badge className="bg-blue-500">{overview.dueKnowledgePoints}</Badge>
                )}
              </div>
              <CardTitle className="text-base">知识点复习</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {overview.dueKnowledgePoints > 0
                  ? "间隔重复巩固已掌握的知识点"
                  : "暂无待复习知识点"}
              </p>
              <Link href="/review/knowledge-points">
                <Button
                  className="w-full gap-1.5"
                  variant={overview.dueKnowledgePoints > 0 ? "default" : "outline"}
                  size="sm"
                >
                  开始复习
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Flashcard Review */}
          <Card className={overview.dueFlashcards > 0 ? "border-violet-200 dark:border-violet-800" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Layers className="h-8 w-8 text-violet-500" />
                {overview.dueFlashcards > 0 && (
                  <Badge className="bg-violet-500">{overview.dueFlashcards}</Badge>
                )}
              </div>
              <CardTitle className="text-base">闪卡复习</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {overview.dueFlashcards > 0 ? "复习到期的闪卡" : "全部掌握！"}
              </p>
              <Link href="/review/session">
                <Button
                  className="w-full gap-1.5"
                  variant={overview.dueFlashcards > 0 ? "default" : "outline"}
                  size="sm"
                >
                  开始复习
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Wrong Answer Review */}
          <Card className={overview.wrongAnswerKps > 0 ? "border-orange-200 dark:border-orange-800" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <BookX className="h-8 w-8 text-orange-500" />
                {overview.wrongAnswerKps > 0 && (
                  <Badge className="bg-orange-500">{overview.wrongAnswerKps}</Badge>
                )}
              </div>
              <CardTitle className="text-base">错题重温</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {overview.wrongAnswerKps > 0
                  ? `${overview.wrongAnswerKps} 个知识点有错题待重做`
                  : "暂无错题"}
              </p>
              <Link href="/questions">
                <Button
                  className="w-full gap-1.5"
                  variant={overview.wrongAnswerKps > 0 ? "default" : "outline"}
                  size="sm"
                >
                  去查看
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed text-center py-12">
          <CardContent>
            <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-lg font-medium">暂无复习任务</p>
            <p className="text-sm text-muted-foreground mt-1">
              去学习新内容，掌握后会自动加入复习队列
            </p>
            <Link href="/courses">
              <Button variant="outline" size="sm" className="mt-4 gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                去学习
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {overview.recentActivity.some((d) => d.flashcards + d.knowledgePoints > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              近7天复习活动
              <span className="text-xs font-normal text-muted-foreground">
                蓝:知识点 · 紫:闪卡
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniActivityChart recentActivity={overview.recentActivity} />
            <div className="flex justify-between mt-2">
              {overview.recentActivity.map((day) => {
                const total = day.flashcards + day.knowledgePoints
                return (
                  <span key={day.date} className="text-[10px] text-muted-foreground w-6 text-center">
                    {total > 0 ? total : ""}
                  </span>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Review Plan */}
      <ReviewPlan />
    </div>
  )
}
