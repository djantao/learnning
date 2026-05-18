"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChatPanel } from "@/components/chat/chat-panel"
import { KpNotes } from "@/components/courses/kp-notes"
import { LearningContent } from "@/components/courses/learning-content"
import { XpCelebration } from "@/components/courses/xp-celebration"
import { XP_PER_KP_MASTERED, xpToLevel, getLevelTitle } from "@/lib/gamification"
import { Star, ArrowLeft, ArrowRight, MessageCircle, X, ChevronRight } from "lucide-react"
import Link from "next/link"

interface KpData {
  id: string; title: string; content: string; status: string; mastery: number
  firstOpenedAt?: string | null
  completedAt?: string | null
  module: { id: string; title: string; courseId: string }
  prev: { id: string; title: string } | null
  next: { id: string; title: string } | null
}

export function CurriculumChat({ kp }: { kp: KpData }) {
  const [mastery, setMastery] = useState(kp.mastery)
  const [chatOpen, setChatOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [totalXp, setTotalXp] = useState(() => {
    if (typeof window === "undefined") return 0
    return parseInt(localStorage.getItem("learnning_xp") || "0", 10)
  })
  const [showCelebration, setShowCelebration] = useState(false)
  const [xpGained, setXpGained] = useState(0)

  useEffect(() => {
    setMastery(kp.mastery)
  }, [kp.id])

  async function updateMastery(value: number) {
    const wasMastered = mastery >= 4
    setMastery(value)
    setSaving(true)
    try {
      await fetch(`/api/knowledge-points/${kp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mastery: value,
          status: value >= 4 ? "mastered" : value > 0 ? "in_progress" : "not_started",
        }),
      })
    } catch { /* ignore */ }
    setSaving(false)

    // Trigger XP celebration when mastering a KP for the first time
    if (value >= 4 && !wasMastered) {
      const newXp = totalXp + XP_PER_KP_MASTERED
      setTotalXp(newXp)
      setXpGained(XP_PER_KP_MASTERED)
      if (typeof window !== "undefined") {
        localStorage.setItem("learnning_xp", String(newXp))
      }
      setShowCelebration(true)

      // Achievement reminder
      try {
        await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "achievement",
            title: `已掌握：${kp.title}`,
            message: `太棒了！你对「${kp.title}」的掌握已达到 ${value}/5 分！`,
          }),
        })
      } catch { /* non-critical */ }
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 relative">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar: breadcrumb + nav */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
          <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
            <Link href={`/courses/${kp.module.courseId}`} className="text-muted-foreground hover:text-foreground shrink-0">课程</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">{kp.module.title}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{kp.title}</span>
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            {kp.prev && (
              <Link href={`/courses/${kp.module.courseId}/learn/${kp.prev.id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8" title={kp.prev.title}><ArrowLeft className="h-4 w-4" /></Button>
              </Link>
            )}
            {kp.next && (
              <Link href={`/courses/${kp.module.courseId}/learn/${kp.next.id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8" title={kp.next.title}><ArrowRight className="h-4 w-4" /></Button>
              </Link>
            )}
            <Button
              variant={chatOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setChatOpen(!chatOpen)}
              className="gap-1.5 text-xs ml-2"
            >
              {chatOpen ? <X className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
              {chatOpen ? "关闭" : "问 AI 老师"}
            </Button>
          </div>
        </div>

        {/* Learning content or empty state */}
        {kp.content ? (
          <div className="flex-1 overflow-hidden">
            <LearningContent
              title={kp.title}
              content={kp.content}
              knowledgePointId={kp.id}
              moduleTitle={kp.module.title}
              mastery={mastery}
              onMasteryChange={updateMastery}
              firstOpenedAt={kp.firstOpenedAt}
              completedAt={kp.completedAt}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-4">
              <p className="text-lg">这个知识点还没有学习内容</p>
              <p className="text-sm">点击右上角"问 AI 老师"来探索这个知识点</p>
              <Button onClick={() => setChatOpen(true)} variant="outline" className="gap-2">
                <MessageCircle className="h-4 w-4" /> 开始学习
              </Button>
            </div>
          </div>
        )}

        {/* Bottom bar: mastery + notes */}
        <div className="border-t bg-card shrink-0">
          <div className="px-4 py-2 flex items-center gap-3 border-b">
            <span className="text-sm text-muted-foreground">掌握度：</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => updateMastery(n)} className="transition-colors" title={`${n}/5`}>
                <Star className={`h-5 w-5 ${n <= mastery ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
              </button>
            ))}
            {saving && <span className="text-xs text-muted-foreground">保存中...</span>}
            {mastery >= 4 && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                已掌握
              </Badge>
            )}
            {/* XP/Level indicator */}
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-amber-500 font-semibold">{totalXp} XP</span>
              <span className="text-muted-foreground/50">|</span>
              <span>Lv.{xpToLevel(totalXp)} {getLevelTitle(xpToLevel(totalXp))}</span>
            </div>
          </div>
          <div className="px-4 py-2">
            <KpNotes knowledgePointId={kp.id} courseId={kp.module.courseId} />
          </div>
        </div>
      </div>

      {/* XP Celebration overlay */}
      <XpCelebration
        show={showCelebration}
        xpGained={xpGained}
        totalXp={totalXp}
        onClose={() => setShowCelebration(false)}
      />

      {/* AI Chat slide-out panel */}
      {chatOpen && (
        <div className="shrink-0 flex flex-col border-l bg-card" style={{ width: 420 }}>
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">AI 老师</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel conversations={[]} courseId={kp.module.courseId} knowledgePointId={kp.id} kpTitle={kp.title} />
          </div>
        </div>
      )}
    </div>
  )
}
