"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Brain, Clock, Zap, AlertCircle, CheckCircle2, X, Loader2, Sparkles } from "lucide-react"

// ============================================================
// Blind Recall Overlay — forced active recall after KP mastery.
// The recall text IS the note. AI compares against source.
// Gaps → auto added to review queue.
// ============================================================

interface Props {
  kpTitle: string; kpId: string
  onComplete: (result: RecallResult | null) => void
  onSkip: () => void
}

export interface RecallResult {
  id: string; recallScore: number
  aiComparison: { accuracy: number; gaps: string[]; strengths: string[]; missedConcepts: string[]; suggestion: string }
}

export function BlindRecallOverlay({ kpTitle, kpId, onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<"intro" | "writing" | "comparing" | "result">("intro")
  const [userRecall, setUserRecall] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<RecallResult | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (phase !== "writing") return
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const submit = useCallback(async () => {
    if (!userRecall.trim()) return
    setPhase("comparing")
    try {
      const saveRes = await fetch("/api/blind-recalls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePointId: kpId, userRecall: userRecall.trim(), timeSpentSeconds: elapsed }),
      })
      if (!saveRes.ok) throw new Error("Save failed")
      const saved = await saveRes.json()

      const compareRes = await fetch("/api/ai/blind-recall/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recallId: saved.id, knowledgePointId: kpId }),
      })
      if (!compareRes.ok) throw new Error("Compare failed")
      setResult(await compareRes.json())
      setPhase("result")
    } catch { setError("AI 对比失败"); setPhase("writing") }
  }, [userRecall, elapsed, kpId])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`
  const wordCount = userRecall.trim().split(/\s+/).filter(Boolean).length

  // ===== INTRO =====
  if (phase === "intro") {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-background rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Brain className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">闭卷回忆</h2>
            <p className="text-sm text-muted-foreground mt-2">你刚掌握了 <strong>{kpTitle}</strong></p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-left text-sm space-y-2">
            <p className="font-medium text-amber-700 dark:text-amber-400">🧠 为什么这样做？</p>
            <p className="text-muted-foreground">主动召回比重复阅读的记忆效果<strong>强 3-5 倍</strong>。写下你记得的一切 — 卡住的地方就是你的薄弱点，AI 会帮你找出来并自动加入复习队列。</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onSkip}>跳过</Button>
            <Button className="flex-1 gap-2" onClick={() => setPhase("writing")}><Zap className="h-4 w-4" />开始回忆</Button>
          </div>
        </div>
      </div>
    )
  }

  // ===== WRITING =====
  if (phase === "writing") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-purple-500" />
            <div><p className="text-sm font-medium">闭卷回忆：{kpTitle}</p><p className="text-xs text-muted-foreground">不要偷看，写下你能记住的一切</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{timeStr}</Badge>
            <Badge variant="outline">{wordCount} 字</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <Textarea
            placeholder={`写下你对 "${kpTitle}" 能记住的所有内容...\n\n• 核心概念是什么？\n• 有哪些关键术语？\n• 它和其他概念有什么联系？\n• 能举一个例子吗？\n\n不需要完美，卡住的地方就是薄弱点。`}
            value={userRecall} onChange={(e) => setUserRecall(e.target.value)}
            className="min-h-full text-base !resize-none border-0 shadow-none focus-visible:ring-0 leading-relaxed" autoFocus
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t shrink-0 bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onSkip}>跳过</Button>
          <Button size="sm" onClick={submit} disabled={!userRecall.trim()} className="gap-2"><Sparkles className="h-4 w-4" />提交并查看对比</Button>
        </div>
      </div>
    )
  }

  // ===== COMPARING =====
  if (phase === "comparing") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto" />
          <p className="text-lg font-medium">AI 正在对比你的回忆和原文...</p>
          <p className="text-sm text-muted-foreground">找出遗漏的概念和薄弱点</p>
        </div>
      </div>
    )
  }

  // ===== RESULT =====
  if (phase === "result" && result) {
    const { aiComparison: c, recallScore } = result
    const pct = Math.round((recallScore ?? 0) * 100)
    const ok = pct >= 70
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            {ok ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-amber-500" />}
            <div><p className="text-sm font-medium">回忆结果</p><p className="text-xs text-muted-foreground">用时 {timeStr}</p></div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onComplete(result)}><X className="h-4 w-4" /></Button>
        </div>
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">召回准确率</span><span className={`text-2xl font-bold ${ok ? "text-green-500" : pct >= 40 ? "text-amber-500" : "text-red-500"}`}>{pct}%</span></div>
          <Progress value={pct} className="h-2.5" />
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {c.strengths.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />你掌握得很好</h3>
              <ul className="space-y-1">{c.strengths.map((s, i) => (<li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-green-400 mt-1 shrink-0">✓</span> {s}</li>))}</ul>
            </div>
          )}
          {c.gaps.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />需要加强</h3>
              <ul className="space-y-1">{c.gaps.map((g, i) => (<li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-red-400 mt-1 shrink-0">✗</span> {g}</li>))}</ul>
            </div>
          )}
          {c.missedConcepts?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5"><Brain className="h-4 w-4" />遗漏的概念</h3>
              <div className="flex flex-wrap gap-1.5">{c.missedConcepts.map((s, i) => (<Badge key={i} variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{s}</Badge>))}</div>
            </div>
          )}
          {c.suggestion && (
            <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-4">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-1 flex items-center gap-1.5"><Sparkles className="h-4 w-4" />AI 建议</p>
              <p className="text-sm text-muted-foreground">{c.suggestion}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border-t shrink-0 bg-muted/30">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onComplete(result)}>返回课程</Button>
          {!ok && <Button size="sm" className="flex-1 gap-2" onClick={() => { setPhase("intro"); setUserRecall(""); setElapsed(0) }}><Zap className="h-4 w-4" />再试一次</Button>}
        </div>
      </div>
    )
  }

  return null
}
