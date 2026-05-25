"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Brain, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Flashcard {
  id: string
  front: string
  back: string
  sm2Interval: number
  sm2Repetitions: number
  sm2Efactor: number
}

export default function ReviewSessionPage() {
  const router = useRouter()
  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [grades, setGrades] = useState<number[]>([])
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    fetchDueCards()
  }, [])

  async function fetchDueCards() {
    try {
      const [cardsRes, sessionRes] = await Promise.all([
        fetch("/api/review/due"),
        fetch("/api/review/sessions", { method: "POST" }),
      ])

      const cardsData = await cardsRes.json()
      const sessionData = await sessionRes.json()

      setCards(cardsData.cards || [])
      setSessionId(sessionData.id)
      if (cardsData.cards?.length === 0) setDone(true)
    } catch {
      toast.error("加载失败")
    } finally {
      setLoading(false)
    }
  }

  async function grade(grade: number) {
    if (!sessionId || currentIndex >= cards.length) return

    const card = cards[currentIndex]
    try {
      await fetch("/api/review/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, grade, sessionId }),
      })
    } catch {
      toast.error("评分失败")
    }

    setGrades([...grades, grade])
    setShowBack(false)

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setDone(true)
    }
  }

  // Finalize session when done
  useEffect(() => {
    if (!done || !sessionId || grades.length === 0) return
    const dist: Record<number, number> = {}
    for (const g of grades) {
      dist[g] = (dist[g] || 0) + 1
    }
    const totalTimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
    fetch("/api/review/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, gradesDistribution: JSON.stringify(dist), totalTimeSeconds }),
    }).catch(() => {})
  }, [done, sessionId, grades])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (done || loading) return
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        if (!showBack) setShowBack(true)
      }
      if (showBack && ["0", "1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault()
        grade(parseInt(e.key))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showBack, currentIndex, done, loading, sessionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Brain className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    )
  }

  if (done && cards.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-24 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="text-xl font-bold">没有待复习的卡片</h2>
        <p className="text-muted-foreground">去写笔记或生成一些闪卡吧</p>
        <Link href="/notes/new">
          <Button>创建笔记</Button>
        </Link>
      </div>
    )
  }

  if (done) {
    const avg = grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : "0"
    return (
      <div className="mx-auto max-w-md space-y-6 py-24 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="text-xl font-bold">复习完成！</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="text-2xl font-bold">{cards.length}</div>
            <div className="text-xs text-muted-foreground">复习卡片</div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-2xl font-bold">{avg}</div>
            <div className="text-xs text-muted-foreground">平均评分</div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-2xl font-bold">{grades.filter((g) => g >= 4).length}</div>
            <div className="text-xs text-muted-foreground">完美/良好</div>
          </div>
        </div>
        <Link href="/">
          <Button>返回仪表盘</Button>
        </Link>
      </div>
    )
  }

  const card = cards[currentIndex]
  const progress = ((currentIndex + (showBack ? 1 : 0)) / cards.length) * 100

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/review">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{currentIndex + 1} / {cards.length}</Badge>
        </div>
      </div>

      <Progress value={progress} className="h-1.5" />

      {/* Flashcard */}
      <Card
        className="min-h-[300px] cursor-pointer transition-all hover:shadow-md"
        onClick={() => !showBack && setShowBack(true)}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
          {!showBack ? (
            <div className="space-y-4">
              <Badge variant="secondary">问题</Badge>
              <div className="text-xl font-medium" dangerouslySetInnerHTML={{ __html: simpleMarkdown(card.front) }} />
              <p className="text-sm text-muted-foreground mt-8">点击卡片或按 空格键 查看答案</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Badge variant="secondary">答案</Badge>
              <div className="text-lg" dangerouslySetInnerHTML={{ __html: simpleMarkdown(card.back) }} />
              <p className="text-xs text-muted-foreground mt-4">
                间隔: {card.sm2Interval}天 | 复习次数: {card.sm2Repetitions} | 易度: {card.sm2Efactor.toFixed(1)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grade buttons */}
      {showBack && (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted-foreground">你记得有多好？</p>
          <div className="flex justify-center gap-2">
            {[
              { grade: 0, label: "完全忘了", key: "0" },
              { grade: 1, label: "错误", key: "1" },
              { grade: 2, label: "勉强", key: "2" },
              { grade: 3, label: "正确但有困难", key: "3" },
              { grade: 4, label: "正确但犹豫", key: "4" },
              { grade: 5, label: "完美", key: "5" },
            ].map((item) => (
              <Button
                key={item.grade}
                variant={item.grade >= 4 ? "default" : item.grade >= 3 ? "outline" : "ghost"}
                size="sm"
                onClick={() => grade(item.grade)}
                className="flex flex-col items-center h-auto py-2 px-3"
              >
                <span className="text-xs font-bold">{item.grade}</span>
                <span className="text-[10px]">{item.label}</span>
              </Button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">按键盘 0-5 快速评分</p>
        </div>
      )}
    </div>
  )
}

function simpleMarkdown(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>")
}
