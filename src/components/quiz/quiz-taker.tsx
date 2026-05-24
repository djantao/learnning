"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send } from "lucide-react"

interface Question {
  id: string; kpId: string; kpTitle: string
  type: "choice" | "short_answer"; content: string; options?: string[]
}

export function QuizTaker({ moduleId, courseId, quizId, questions, moduleTitle }: {
  moduleId: string; courseId: string; quizId: string
  questions: Question[]; moduleTitle: string
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function setAnswer(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }))
  }

  async function submit() {
    const answerList = questions.map((q) => ({ qId: q.id, answer: answers[q.id] || "" }))
    setSubmitting(true)
    try {
      const res = await fetch(`/api/modules/${moduleId}/quiz/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerList }),
      })
      if (res.ok) {
        router.push(`/courses/${courseId}/quiz/${moduleId}/result/${quizId}`)
        router.refresh()
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const allAnswered = questions.every((q) => (answers[q.id] || "").trim().length > 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">模块测验</h2>
          <p className="text-sm text-muted-foreground">{moduleTitle} · {questions.length} 题</p>
        </div>
        <Button onClick={submit} disabled={!allAnswered || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          提交
        </Button>
      </div>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{i + 1}</Badge>
              <CardTitle className="text-sm">{q.content}</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={q.type === "choice" ? "secondary" : "outline"} className="text-[10px]">
                {q.type === "choice" ? "选择" : "简答"}
              </Badge>
              <span>{q.kpTitle}</span>
            </div>
          </CardHeader>
          <CardContent>
            {q.type === "choice" && q.options ? (
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const letter = opt.slice(0, 1)
                  const selected = answers[q.id] === letter
                  return (
                    <label key={letter} className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}>
                      <input type="radio" name={q.id} value={letter} checked={selected}
                        onChange={(e) => setAnswer(q.id, e.target.value)} className="sr-only" />
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {letter}
                      </span>
                      <span className="text-sm">{opt.slice(3)}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <textarea className="w-full min-h-[100px] p-3 text-sm rounded-md border bg-background resize-y"
                placeholder="输入你的答案..." value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
