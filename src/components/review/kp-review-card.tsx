"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Brain, CheckCircle2, ArrowLeft, Eye, Lightbulb, Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface KpReviewData {
  id: string; title: string; content: string; mastery: number
  sm2Interval: number; sm2Repetitions: number; sm2Efactor: number
  sm2NextReview: string | null; lastReviewedAt: string | null
  module: { id: string; title: string; course: { id: string; title: string; icon: string; color: string } }
}

const GRADE_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "完全忘记", color: "bg-red-500 hover:bg-red-600" },
  1: { label: "模糊记得", color: "bg-orange-500 hover:bg-orange-600" },
  2: { label: "勉强想起", color: "bg-amber-500 hover:bg-amber-600" },
  3: { label: "有困难", color: "bg-yellow-500 hover:bg-yellow-600" },
  4: { label: "犹豫后正确", color: "bg-lime-500 hover:bg-lime-600" },
  5: { label: "完美回忆", color: "bg-green-500 hover:bg-green-600" },
}

/** 从知识点内容提取纯文本摘要 */
function extractSummary(content: string | undefined | null): string {
  if (!content) return ""
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^#{1,4}\s.*$/gm, "")
    .replace(/\*\*|__|\*|`/g, "")
    .trim()
    .split("\n\n")
    .slice(0, 2)
    .join("\n\n")
    .slice(0, 500)
}

/** 根据复习次数生成不同角度的回忆提示 */
function getRecallPrompt(title: string, repetitions: number): string {
  const prompts = [
    `用你自己的话解释「${title}」是什么，以及它解决什么问题。`,
    `回忆「${title}」的核心概念和关键规则。能想起几个？`,
    `假设你要教一个新手「${title}」，你会怎么讲？写下要点。`,
    `「${title}」在你的实际学习/工作中能怎么用？举一个具体场景。`,
    `比较「${title}」和它相关的概念——它们之间有什么联系和区别？`,
  ]
  return prompts[Math.min(repetitions, prompts.length - 1)]
}

export function KpReviewCard({ kp }: { kp: KpReviewData }) {
  const router = useRouter()
  const [phase, setPhase] = useState<"recall" | "reveal" | "rated">("recall")
  const [recallText, setRecallText] = useState("")
  const [rated, setRated] = useState(false)
  const [nextReview, setNextReview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  const summary = extractSummary(kp.content)
  const recallPrompt = getRecallPrompt(kp.title, kp.sm2Repetitions)

  async function handleReveal() {
    setPhase("reveal")
    // 如果用户写了回忆内容，异步获取 AI 反馈
    if (recallText.trim().length > 20) {
      setEvaluating(true)
      try {
        const res = await fetch("/api/ai/review/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpTitle: kp.title,
            kpContent: summary,
            userRecall: recallText.trim(),
          }),
        })
        const data = await res.json()
        if (data.feedback) setAiFeedback(data.feedback)
      } catch { /* AI 评估失败不影响复习流程 */ }
      setEvaluating(false)
    }
  }

  async function rate(grade: number) {
    setLoading(true)
    try {
      const res = await fetch("/api/review/knowledge-points/grade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpId: kp.id, grade }),
      })
      const data = await res.json()
      setNextReview(data.nextReviewDate)
      setRated(true)
      setPhase("rated")
    } catch { toast.error("评分失败") }
    setLoading(false)
  }

  if (rated || phase === "rated") {
    const nextDate = nextReview ? new Date(nextReview) : new Date()
    return (
      <div className="text-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <div>
          <p className="text-lg font-semibold">复习完成！</p>
          <p className="text-sm text-muted-foreground mt-1">
            下次复习：{nextDate.toLocaleDateString("zh-CN", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => router.push("/review/knowledge-points")}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回队列
          </Button>
          <Button onClick={() => router.push(`/courses/${kp.module.course.id}/learn/${kp.id}`)}>
            去学习
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="shrink-0 h-10 w-10 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: `${kp.module.course.color}20`, color: kp.module.course.color }}>
          {kp.module.course.icon}
        </div>
        <div>
          <h2 className="text-lg font-bold">{kp.title}</h2>
          <p className="text-sm text-muted-foreground">{kp.module.course.title} · {kp.module.title}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
        <Badge variant="secondary">复习 {kp.sm2Repetitions} 次</Badge>
        <Badge variant="secondary">间隔 {kp.sm2Interval} 天</Badge>
        <Badge variant="secondary">掌握度 {kp.mastery}/5</Badge>
        {kp.lastReviewedAt && (
          <Badge variant="outline" className="text-[10px]">
            {Math.ceil((Date.now() - new Date(kp.lastReviewedAt).getTime()) / 86400000)}天前
          </Badge>
        )}
      </div>

      {/* Phase 1: Active Recall */}
      {phase === "recall" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">主动回忆</span>
              <Badge variant="outline" className="text-[10px]">第{kp.sm2Repetitions + 1}次复习</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{recallPrompt}</p>
            <Textarea
              placeholder="在这里写下你能回忆起来的内容...（可选，但强烈建议写下来）"
              value={recallText}
              onChange={(e) => setRecallText(e.target.value)}
              className="min-h-[120px] text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              💡 研究表明：主动回忆比被动重读的记忆效果高 2-3 倍。
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleReveal} className="flex-1 gap-2">
              <Eye className="h-4 w-4" />
              查看答案
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setPhase("reveal")}>
              跳过回忆
            </Button>
          </div>
        </div>
      )}

      {/* Phase 2: Reveal + Compare + Grade */}
      {phase === "reveal" && (
        <div className="space-y-4">
          {/* Original content */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">知识点内容</span>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {summary || kp.title}
            </div>
          </div>

          {/* User's recall vs original */}
          {recallText.trim() && (
            <div className="rounded-lg border border-dashed p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">你的回忆</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{recallText}</p>
            </div>
          )}

          {/* AI Feedback */}
          {evaluating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI 正在评估你的回忆...
            </div>
          )}
          {aiFeedback && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">AI 反馈</span>
              </div>
              <p className="text-sm text-muted-foreground">{aiFeedback}</p>
            </div>
          )}

          {/* Grade buttons */}
          <div>
            <p className="text-sm font-medium mb-3">对比原文后，你的回忆质量如何？</p>
            <div className="grid grid-cols-3 gap-2">
              {([0, 1, 2, 3, 4, 5] as const).map((grade) => {
                const g = GRADE_LABELS[grade]
                return (
                  <Button
                    key={grade}
                    variant="outline"
                    className={`h-auto py-3 flex-col gap-1 ${g.color} text-white border-0`}
                    disabled={loading}
                    onClick={() => rate(grade)}
                  >
                    <span className="text-sm font-bold">{grade}</span>
                    <span className="text-[10px]">{g.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
