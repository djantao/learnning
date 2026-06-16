"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChatPanel } from "@/components/chat/chat-panel"
import { LearningNotes } from "@/components/notes/learning-notes"
import { BlindRecallOverlay } from "@/components/recall/blind-recall-overlay"
import type { RecallResult } from "@/components/recall/blind-recall-overlay"
import { LearningContent } from "@/components/courses/learning-content"
import { StudyTimer } from "@/components/courses/study-timer"
import { MindMapView } from "@/components/courses/mindmap-view"
import { XpCelebration } from "@/components/courses/xp-celebration"
import { XP_PER_KP_MASTERED, xpToLevel, getLevelTitle } from "@/lib/gamification"
import { toast } from "sonner"
import { Star, ArrowLeft, ArrowRight, MessageCircle, X, ChevronRight, Trophy, FileText, Loader2, GitBranch, Users, PenLine, StickyNote } from "lucide-react"
import Link from "next/link"

interface KpData {
  id: string; title: string; content: string; status: string; mastery: number
  firstOpenedAt?: string | null
  completedAt?: string | null
  module: { id: string; title: string; courseId: string }
  courseTitle: string
  prev: { id: string; title: string } | null
  next: { id: string; title: string } | null
  isLastInModule?: boolean
  moduleKpCount?: number
}

export function CurriculumChat({ kp }: { kp: KpData }) {
  const [mastery, setMastery] = useState(kp.mastery)
  const [chatOpen, setChatOpen] = useState(false)
  const [rightPanel, setRightPanel] = useState<"notes" | "chat">("notes")
  const [saving, setSaving] = useState(false)
  const [totalXp, setTotalXp] = useState(0)

  useEffect(() => {
    async function loadXp() {
      try {
        const res = await fetch("/api/user/xp")
        if (!res.ok) return
        const data = await res.json()
        if (data.xp > 0) { setTotalXp(data.xp); return }
        const localXp = parseInt(localStorage.getItem("learnning_xp") || "0", 10)
        if (localXp > 0) {
          const migrateRes = await fetch("/api/user/xp", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xp: localXp }),
          })
          if (migrateRes.ok) {
            const migrated = await migrateRes.json()
            setTotalXp(migrated.xp)
            localStorage.removeItem("learnning_xp")
          }
        }
      } catch {}
    }
    loadXp()
  }, [])

  const [showCelebration, setShowCelebration] = useState(false)
  const [xpGained, setXpGained] = useState(0)
  const [showMasteryPrompt, setShowMasteryPrompt] = useState(false)
  const [learningContentKey, setLearningContentKey] = useState(0)
  const [practiceDefaultTab, setPracticeDefaultTab] = useState<"content" | "practice">("content")
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false)
  const [completionAction, setCompletionAction] = useState<"article" | "interview" | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<{ title: string; content: string } | null>(null)
  const [mindmapOpen, setMindmapOpen] = useState(false)
  const [showBlindRecall, setShowBlindRecall] = useState(false)
  const [lastRecallResult, setLastRecallResult] = useState<RecallResult | null>(null)

  useEffect(() => { setMastery(kp.mastery) }, [kp.id])

  // Heartbeat on mount — ensures daily activity record exists
  useEffect(() => {
    fetch("/api/activity/heartbeat", { method: "POST" }).catch(() => {})
  }, [kp.id])

  // Save resume position
  useEffect(() => {
    fetch("/api/user/resume", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: kp.module.courseId, kpId: kp.id }),
    }).catch(() => {})
  }, [kp.id, kp.module.courseId])

  async function updateMastery(value: number) {
    const wasMastered = mastery >= 4
    setMastery(value)
    setSaving(true)
    try {
      await fetch(`/api/knowledge-points/${kp.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mastery: value, status: value >= 4 ? "mastered" : value > 0 ? "in_progress" : "not_started" }),
      })
    } catch { /* ignore */ }
    setSaving(false)

    if (value >= 4 && !wasMastered) {
      const newXp = totalXp + XP_PER_KP_MASTERED
      setTotalXp(newXp)
      setXpGained(XP_PER_KP_MASTERED)
      fetch("/api/user/xp", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addXp: XP_PER_KP_MASTERED }),
      }).catch(() => {})
      setShowCelebration(true)

      try {
        await fetch("/api/reminders", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "achievement", title: `已掌握：${kp.title}`, message: `太棒了！你对「${kp.title}」的掌握已达到 ${value}/5 分！` }),
        })
      } catch {}

      // 核心改动：弹出全屏盲写回忆，取代之前的小横幅
      setShowBlindRecall(true)
    }
  }

  function openChat() {
    setChatOpen(true)
    setRightPanel("chat")
  }

  return (
    <div className="flex h-full gap-0 relative -mx-3 -mt-3 -mb-[calc(1rem+3.25rem+env(safe-area-inset-bottom,0px))] sm:-mx-4 sm:-mt-4 md:-mx-6 md:-mt-6 lg:-mx-6 lg:-my-6">
      {/* === MAIN CONTENT === */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
          <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
            <Link href={`/courses/${kp.module.courseId}`} className="text-muted-foreground hover:text-foreground shrink-0">课程</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate" title={kp.module.title}>{kp.module.title}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate" title={kp.title}>{kp.title}</span>
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <Button variant="outline" size="sm" onClick={() => setMindmapOpen(true)} className="gap-1.5 text-xs">
              <GitBranch className="h-3.5 w-3.5" />思维导图
            </Button>
            <Link href={`/coach?kpId=${kp.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-blue-300 text-blue-600 hover:bg-blue-50">
                <Users className="h-3.5 w-3.5" />教练问答
              </Button>
            </Link>
            {/* Desktop: toggle right panel chat tab. Mobile: open overlay */}
            <Button
              variant={chatOpen || rightPanel === "chat" ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                if (chatOpen) { setChatOpen(false); return }
                if (rightPanel === "chat") { setRightPanel("notes"); return }
                openChat()
              }}
              className="gap-1.5 text-xs hidden xl:inline-flex"
            >
              {rightPanel === "chat" ? <X className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
              {rightPanel === "chat" ? "关闭" : "AI 老师"}
            </Button>
            <Button
              variant={chatOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setChatOpen(!chatOpen)}
              className="gap-1.5 text-xs xl:hidden"
            >
              {chatOpen ? <X className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
              {chatOpen ? "关闭" : "AI 老师"}
            </Button>
          </div>
        </div>

        {/* Scrollable centered content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
            {/* Timer + Mastery row */}
            <div className="flex items-center justify-between">
              <StudyTimer />
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => updateMastery(n)} className="transition-colors" title={`${n}/5`}>
                    <Star className={`h-4 w-4 ${n <= mastery ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
                {saving && <span className="text-[10px] text-muted-foreground ml-1">...</span>}
                {mastery >= 4 && (
                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ml-1">已掌握</Badge>
                )}
              </div>
            </div>

            {/* Learning Content */}
            {kp.content ? (
              <LearningContent
                key={learningContentKey}
                title={kp.title}
                content={kp.content}
                knowledgePointId={kp.id}
                moduleTitle={kp.module.title}
                courseTitle={kp.courseTitle}
                mastery={mastery}
                onMasteryChange={updateMastery}
                firstOpenedAt={kp.firstOpenedAt}
                completedAt={kp.completedAt}
                defaultTab={practiceDefaultTab}
              />
            ) : (
              <div className="flex items-center justify-center py-24 text-muted-foreground">
                <div className="text-center space-y-4">
                  <p className="text-lg">这个知识点还没有学习内容</p>
                  <p className="text-sm">点击右上角"AI 老师"来探索这个知识点</p>
                  <Button onClick={openChat} variant="outline" className="gap-2">
                    <MessageCircle className="h-4 w-4" /> 开始学习
                  </Button>
                </div>
              </div>
            )}

            {/* Post-mastery prompt */}
            {showMasteryPrompt && kp.next && (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">🎯</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">已掌握！该知识点已加入复习队列</p>
                    <p className="text-xs text-muted-foreground">明天起可通过间隔重复来巩固记忆</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Button size="sm" variant="outline"
                    className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 h-8"
                    onClick={() => { setShowMasteryPrompt(false); setPracticeDefaultTab("practice"); setLearningContentKey(k => k + 1) }}>
                    <PenLine className="h-3.5 w-3.5 mr-1" />趁热打铁做练习
                  </Button>
                  <Link href={`/courses/${kp.module.courseId}/learn/${kp.next.id}`}>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowMasteryPrompt(false)}>
                      继续下一个<ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowMasteryPrompt(false)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}

            {/* Footer: prev/next + XP */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-1">
                {kp.prev && (
                  <Link href={`/courses/${kp.module.courseId}/learn/${kp.prev.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />上一节</Button>
                  </Link>
                )}
                {kp.next && (
                  <Link href={`/courses/${kp.module.courseId}/learn/${kp.next.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1">下一节<ArrowRight className="h-4 w-4" /></Button>
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-amber-500 font-semibold">{totalXp} XP</span>
                <span className="text-muted-foreground/50">|</span>
                <span>Lv.{xpToLevel(totalXp)} {getLevelTitle(xpToLevel(totalXp))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === RIGHT PANEL (xl+): Tabbed Notes + Chat === */}
      <div className="hidden xl:flex w-80 shrink-0 border-l bg-card flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setRightPanel("notes")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2",
              rightPanel === "notes"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <StickyNote className="h-3.5 w-3.5" />笔记
          </button>
          <button
            onClick={() => setRightPanel("chat")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2",
              rightPanel === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />AI 老师
          </button>
        </div>
        {/* Panel content */}
        {rightPanel === "notes" ? (
          <LearningNotes knowledgePointId={kp.id} />
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <ChatPanel conversations={[]} courseId={kp.module.courseId} knowledgePointId={kp.id} kpTitle={kp.title} />
          </div>
        )}
      </div>

      {/* === MOBILE CHAT OVERLAY === */}
      {chatOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex flex-col bg-card">
          <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 pt-[env(safe-area-inset-top,0px)]">
            <span className="text-sm font-medium">AI 老师</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
            <ChatPanel conversations={[]} courseId={kp.module.courseId} knowledgePointId={kp.id} kpTitle={kp.title} />
          </div>
        </div>
      )}

      {/* === OVERLAYS === */}
      <XpCelebration show={showCelebration} xpGained={xpGained} totalXp={totalXp} onClose={() => setShowCelebration(false)} />

      {/* Module Completion Dialog */}
      <Dialog open={showCompletionPrompt} onOpenChange={setShowCompletionPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />模块学习完成！</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">你已经完成了「{kp.module.title}」模块的{(kp as any).moduleKpCount || ""}个知识点。太棒了！</p>
            <p className="text-sm">选择一个输出方式巩固所学：</p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start gap-3 h-auto py-3"
                onClick={async () => {
                  setCompletionAction("article"); setGenerating(true)
                  try {
                    const res = await fetch("/api/ai/generate-article", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ moduleId: kp.module.id, courseTitle: kp.courseTitle, moduleTitle: kp.module.title }),
                    })
                    const data = await res.json()
                    if (data.title) {
                      setGeneratedContent(data)
                      await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: data.title, content: data.content, tags: ["learning-output"] }) })
                      toast.success("文章已生成并保存为笔记")
                    }
                  } catch { toast.error("文章生成失败") }
                  setGenerating(false)
                }} disabled={generating}>
                <FileText className="h-5 w-5 text-blue-500" />
                <div className="text-left"><p className="font-medium text-sm">撰写学习文章</p><p className="text-xs text-muted-foreground">生成一篇专业技术文章总结所学内容</p></div>
                {generating && completionAction === "article" && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
              </Button>
              <Button variant="outline" className="justify-start gap-3 h-auto py-3"
                onClick={async () => {
                  setCompletionAction("interview"); setGenerating(true)
                  try {
                    const res = await fetch("/api/ai/generate-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ knowledgePointId: kp.id, style: "interview" }) })
                    const data = await res.json()
                    if (data.questions) { setGeneratedContent({ title: "面试自检", content: data.questions.join("\n\n") }); toast.success("面试题已生成") }
                  } catch { toast.error("题目生成失败") }
                  setGenerating(false)
                }} disabled={generating}>
                <MessageCircle className="h-5 w-5 text-purple-500" />
                <div className="text-left"><p className="font-medium text-sm">面试自检</p><p className="text-xs text-muted-foreground">生成面试风格的问题进行自我检测</p></div>
                {generating && completionAction === "interview" && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
              </Button>
            </div>
            {generatedContent && (
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium mb-1">{generatedContent.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{generatedContent.content.slice(0, 300)}</p>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowCompletionPrompt(false)}>稍后再说</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mind Map Dialog */}
      <Dialog open={mindmapOpen} onOpenChange={setMindmapOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>思维导图 — {kp.module.title}</DialogTitle></DialogHeader>
          <MindMapView moduleId={kp.module.id} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
