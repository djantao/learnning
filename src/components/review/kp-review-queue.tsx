"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Brain, ArrowRight, Clock, Zap, AlertTriangle } from "lucide-react"
import Link from "next/link"

interface DueKp {
  id: string; title: string; mastery: number
  sm2Interval: number; sm2Repetitions: number
  sm2NextReview: string | null; lastReviewedAt: string | null
  module: { id: string; title: string; course: { id: string; title: string; icon: string; color: string } }
}

export function KpReviewQueue({ focus, cram }: { focus?: boolean; cram?: boolean }) {
  const [dueKps, setDueKps] = useState<DueKp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (focus) params.set("focus", "weak")
    if (cram) params.set("cram", "true")
    const qs = params.toString()
    fetch(`/api/review/knowledge-points/due${qs ? `?${qs}` : ""}`)
      .then((r) => r.json()).then(setDueKps).catch(() => {}).finally(() => setLoading(false))
  }, [focus, cram])

  const modeLabel = focus ? "薄弱点" : cram ? "突击" : null
  const modeIcon = focus ? <AlertTriangle className="h-4 w-4" /> : cram ? <Zap className="h-4 w-4" /> : null

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
  }

  if (dueKps.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="mt-3 text-muted-foreground">
          {focus ? "没有薄弱知识点需要复习" : cram ? "没有需要突击的知识点" : "没有待复习的知识点"}
        </p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          {focus ? "继续学习新内容，系统会自动追踪薄弱点" : cram ? "先去掌握一些知识点吧" : "掌握新知识点后会自动加入复习队列"}
        </p>
        {!focus && !cram && (
          <Link href="/review/knowledge-points?cram=true"><Button variant="outline" size="sm" className="mt-3 gap-1"><Zap className="h-3 w-3" />突击模式</Button></Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Mode Switcher */}
      <div className="flex items-center gap-2">
        {modeLabel && (
          <Badge className={focus ? "bg-orange-500" : "bg-red-500"}>
            {modeIcon}
            <span className="ml-1">{modeLabel}模式</span>
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{dueKps.length} 个知识点</span>
        <div className="flex-1" />
        {focus && <Link href="/review/knowledge-points"><Button variant="ghost" size="sm" className="h-7 text-xs">标准模式</Button></Link>}
        {cram && <Link href="/review/knowledge-points"><Button variant="ghost" size="sm" className="h-7 text-xs">标准模式</Button></Link>}
        {!focus && !cram && (
          <Link href="/review/knowledge-points?cram=true"><Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Zap className="h-3 w-3" />突击</Button></Link>
        )}
      </div>

      {/* KP List */}
      <div className="space-y-2">
        {dueKps.map((kp) => (
          <Link key={kp.id} href={`/review/knowledge-points/${kp.id}`}
            className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/50 transition-colors">
            <div className="shrink-0 h-8 w-8 rounded flex items-center justify-center text-sm"
              style={{ backgroundColor: `${kp.module.course.color}20`, color: kp.module.course.color }}>
              {kp.module.course.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{kp.title}</p>
                {focus && kp.mastery <= 2 && <Badge className="bg-red-500 text-[10px]">需加强</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {kp.module.course.title} · {kp.module.title}
                {kp.lastReviewedAt && (
                  <span className="ml-2"><Clock className="inline h-3 w-3 mr-0.5" />{Math.ceil((Date.now() - new Date(kp.lastReviewedAt).getTime()) / 86400000)}天前</span>
                )}
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {cram ? `掌握度${kp.mastery}` : `间隔${kp.sm2Interval}天`}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
