"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, CheckCircle2, ArrowLeft } from "lucide-react"
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

export function KpReviewCard({ kp }: { kp: KpReviewData }) {
  const router = useRouter()
  const [rated, setRated] = useState(false)
  const [nextReview, setNextReview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const summary = kp.content
    ?.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^#+\s.*$/gm, "")
    .replace(/\*\*|__/g, "")
    .trim().split("\n\n")[0]?.slice(0, 300) || ""

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
    } catch { toast.error("评分失败") }
    setLoading(false)
  }

  if (rated) {
    const nextDate = nextReview ? new Date(nextReview) : new Date()
    return (
      <div className="text-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <div><p className="text-lg font-semibold">复习完成！</p>
          <p className="text-sm text-muted-foreground mt-1">下次复习：{nextDate.toLocaleDateString("zh-CN")}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => router.push("/review/knowledge-points")}><ArrowLeft className="h-4 w-4 mr-1" />返回队列</Button>
          <Button onClick={() => router.push(`/courses/${kp.module.course.id}/learn/${kp.id}`)}>去学习</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="shrink-0 h-10 w-10 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: `${kp.module.course.color}20`, color: kp.module.course.color }}>
          {kp.module.course.icon}
        </div>
        <div><h2 className="text-lg font-bold">{kp.title}</h2>
          <p className="text-sm text-muted-foreground">{kp.module.course.title} · {kp.module.title}</p></div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-primary" /><span className="text-sm font-medium">回忆一下：这个知识点讲了什么？</span></div>
        <p className="text-sm text-muted-foreground leading-relaxed">{summary || kp.title}</p>
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">复习 {kp.sm2Repetitions} 次</Badge>
        <Badge variant="secondary">间隔 {kp.sm2Interval} 天</Badge>
        <Badge variant="secondary">掌握度 {kp.mastery}/5</Badge>
      </div>
      <div><p className="text-sm font-medium mb-3">你的回忆质量如何？</p>
        <div className="grid grid-cols-3 gap-2">
          {([0,1,2,3,4,5] as const).map((grade) => {
            const g = GRADE_LABELS[grade]
            return <Button key={grade} variant="outline" className={`h-auto py-3 flex-col gap-1 ${g.color} text-white border-0`} disabled={loading} onClick={() => rate(grade)}><span className="text-sm font-bold">{grade}</span><span className="text-[10px]">{g.label}</span></Button>
          })}
        </div>
      </div>
    </div>
  )
}
