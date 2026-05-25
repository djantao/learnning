"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Brain, BookOpen, Play, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

interface PlanItem {
  kpTitle: string
  moduleTitle: string
  courseId: string
  flashcards: { front: string; back: string }[]
}

export function ReviewPlan() {
  const [plan, setPlan] = useState<PlanItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function generate() {
    setLoading(true)
    setPlan(null)
    try {
      const res = await fetch("/api/ai/review/generate-plan", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.message) {
        setMessage(data.message)
      } else {
        setPlan(data.plan)
      }
    } catch {
      toast.error("生成失败，请稍后重试")
    }
    setLoading(false)
  }

  const totalCards = plan?.reduce((sum, p) => sum + p.flashcards.length, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI 复习计划</h3>
          <p className="text-sm text-muted-foreground">根据你的学习情况自动生成复习内容</p>
        </div>
        <Button onClick={generate} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "生成中..." : "生成复习计划"}
        </Button>
      </div>

      {message && (
        <Card className="p-8 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </Card>
      )}

      {plan && (
        <>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <Brain className="h-3 w-3" />
              {plan.length} 个知识点
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {totalCards} 张闪卡
            </Badge>
            {plan.length > 0 && (
              <Link href="/review/session">
                <Button size="sm" className="gap-1 h-7 text-xs">
                  <Play className="h-3 w-3" />
                  开始复习
                </Button>
              </Link>
            )}
          </div>

          <ScrollArea className="max-h-[500px]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {plan.map((item, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm truncate">{item.kpTitle}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{item.moduleTitle}</p>
                      </div>
                      <Badge className="text-[10px] shrink-0">{item.flashcards.length} 张卡</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {item.flashcards.length > 0 ? (
                      <div className="space-y-1.5">
                        {item.flashcards.slice(0, 3).map((fc, j) => (
                          <div key={j} className="text-xs border rounded-md p-2 bg-muted/30">
                            <p className="font-medium truncate">Q: {fc.front}</p>
                            <p className="text-muted-foreground truncate mt-0.5">A: {fc.back}</p>
                          </div>
                        ))}
                        {item.flashcards.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">+{item.flashcards.length - 3} 张更多...</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">生成中遇到问题，请稍后重试</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}
