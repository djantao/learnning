"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Brain, ArrowRight, Clock } from "lucide-react"
import Link from "next/link"

interface DueKp {
  id: string; title: string; mastery: number
  sm2Interval: number; sm2Repetitions: number
  sm2NextReview: string | null; lastReviewedAt: string | null
  module: { id: string; title: string; course: { id: string; title: string; icon: string; color: string } }
}

export function KpReviewQueue() {
  const [dueKps, setDueKps] = useState<DueKp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/review/knowledge-points/due")
      .then((r) => r.json()).then(setDueKps).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
  }

  if (dueKps.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="mt-3 text-muted-foreground">没有待复习的知识点</p>
        <p className="text-sm text-muted-foreground/60 mt-1">掌握新知识点后会自动加入复习队列</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {dueKps.map((kp) => (
        <Link key={kp.id} href={`/review/knowledge-points/${kp.id}`}
          className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/50 transition-colors">
          <div className="shrink-0 h-8 w-8 rounded flex items-center justify-center text-sm"
            style={{ backgroundColor: `${kp.module.course.color}20`, color: kp.module.course.color }}>
            {kp.module.course.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{kp.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {kp.module.course.title} · {kp.module.title}
              {kp.lastReviewedAt && <span className="ml-2"><Clock className="inline h-3 w-3 mr-0.5" />{Math.ceil((Date.now() - new Date(kp.lastReviewedAt).getTime()) / 86400000)}天前</span>}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">间隔{kp.sm2Interval}天</Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      ))}
    </div>
  )
}
