"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, Lightbulb, Star, Brain, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

interface QuestionDetail {
  isCorrect: boolean
  correctAnswer: string
  explanation: string
}

interface PracticePanelProps {
  knowledgePointId: string
  kpTitle: string
  mastery: number
  onMasteryChange: (value: number) => void
}

export function PracticePanel({ knowledgePointId, kpTitle, mastery, onMasteryChange }: PracticePanelProps) {
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [suggestedScore, setSuggestedScore] = useState<number | null>(null)
  const [details, setDetails] = useState<QuestionDetail[] | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setQuestions([])
      setAnswers([])
      setFeedback(null)
      setSuggestedScore(null)
      setDetails(null)
      setSubmitted(false)
      try {
        const res = await fetch("/api/ai/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knowledgePointId }),
        })
        if (!res.ok || cancelled) { setLoading(false); return }
        const data = await res.json()
        if (!cancelled && data.questions) {
          setQuestions(data.questions)
          setAnswers(new Array(data.questions.length).fill(""))
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [knowledgePointId])

  async function handleSubmit() {
    if (answers.some((a) => !a.trim())) {
      toast.error("请先回答所有题目")
      return
    }
    setEvaluating(true)
    try {
      const res = await fetch("/api/ai/evaluate-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePointId, questions, answers }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedback(data.feedback)
        setSuggestedScore(data.suggestedScore)
        setDetails(data.details ?? null)
        setSubmitted(true)
        toast.success("评估完成")
      } else {
        toast.error(data.error || "评估失败")
      }
    } catch {
      toast.error("网络错误")
    }
    setEvaluating(false)
  }

  function applyScore() {
    if (suggestedScore !== null) {
      onMasteryChange(suggestedScore)
      toast.success(`掌握度已更新为 ${suggestedScore}/5`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">AI 正在出题...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">知识点练习：{kpTitle}</h3>
        </div>

        {questions.map((q, i) => {
          const d = details?.[i]
          return (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium">
                <span className="text-primary font-bold mr-1">Q{i + 1}.</span>
                {q}
              </p>
              <Textarea
                placeholder="输入你的回答..."
                value={answers[i] || ""}
                onChange={(e) => {
                  const next = [...answers]
                  next[i] = e.target.value
                  setAnswers(next)
                }}
                disabled={submitted}
                className="min-h-[80px] resize-none"
              />
              {d && (
                <div className={`rounded-lg border p-3 text-sm ${d.isCorrect ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center gap-1.5 mb-1 font-medium">
                    {d.isCorrect ? (
                      <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-emerald-700">回答正确</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-red-600" /><span className="text-red-700">回答有误</span></>
                    )}
                  </div>
                  {!d.isCorrect && (
                    <p className="mb-0.5">
                      <span className="font-medium text-red-800">正确答案：</span>
                      <span className="text-red-700">{d.correctAnswer}</span>
                    </p>
                  )}
                  <p className="text-muted-foreground">{d.explanation}</p>
                </div>
              )}
            </div>
          )
        })}

        {feedback && (
          <div className="rounded-xl border bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-sm">AI 总评</span>
              {suggestedScore !== null && (
                <Badge variant={suggestedScore >= 4 ? "secondary" : "outline"} className="ml-auto">
                  建议掌握度：{suggestedScore}/5
                </Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed">{feedback}</p>
            {suggestedScore !== null && suggestedScore !== mastery && (
              <Button size="sm" onClick={applyScore} className="gap-1.5">
                <Star className="h-3.5 w-3.5" />
                采纳建议，更新掌握度
              </Button>
            )}
          </div>
        )}
      </div>

      {!submitted && (
        <div className="border-t bg-card px-6 py-3 shrink-0">
          <Button onClick={handleSubmit} disabled={evaluating} className="w-full gap-2">
            {evaluating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> AI 正在批改...</>
            ) : (
              <><Send className="h-4 w-4" /> 提交评估</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
