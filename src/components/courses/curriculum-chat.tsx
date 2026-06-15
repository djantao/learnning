"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChatPanel } from "@/components/chat/chat-panel"
import { KpNotes } from "@/components/courses/kp-notes"
import { LearningContent } from "@/components/courses/learning-content"
import { MindMapView } from "@/components/courses/mindmap-view"
import { XpCelebration } from "@/components/courses/xp-celebration"
import { XP_PER_KP_MASTERED, xpToLevel, getLevelTitle } from "@/lib/gamification"
import { toast } from "sonner"
import { Star, ArrowLeft, ArrowRight, MessageCircle, X, ChevronRight, Trophy, FileText, Loader2, GitBranch, Users, PenLine } from "lucide-react"
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
  const [saving, setSaving] = useState(false)
  const [totalXp, setTotalXp] = useState(0)

  // 从数据库加载 XP（首次自动迁移 localStorage 数据）
  useEffect(() => {
    async function loadXp() {
      try {
        const res = await fetch("/api/user/xp")
        if (!res.ok) return
        const data = await res.json()
        if (data.xp > 0) {
          setTotalXp(data.xp)
          return
        }
        // 首次：检查是否有 localStorage 旧数据需要迁移
        const localXp = parseInt(localStorage.getItem("learnning_xp") || "0", 10)
        if (localXp > 0) {
          const migrateRes = await fetch("/api/user/xp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xp: localXp }),
          })
          if (migrateRes.ok) {
            const migrated = await migrateRes.json()
            setTotalXp(migrated.xp)
            localStorage.removeItem("learnning_xp") // 迁移后清除旧数据
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

  useEffect(() => {
    setMastery(kp.mastery)
  }, [kp.id])

  // Save resume position on mount
  useEffect(() => {
    fetch("/api/user/resume", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: kp.module.courseId, kpId: kp.id }),
    }).catch(() => {})
  }, [kp.id, kp.module.courseId])

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
      // 持久化 XP 到数据库
      fetch("/api/user/xp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addXp: XP_PER_KP_MASTERED }),
      }).catch(() => {})
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

      // Trigger module completion prompt if last KP in module
      if (kp.isLastInModule) {
        setShowCompletionPrompt(true)
      } else {
        // Show post-mastery review prompt for non-last KPs
        setShowMasteryPrompt(true)
      }
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
            <span className="text-muted-foreground truncate" title={kp.module.title}>{kp.module.title}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate" title={kp.title}>{kp.title}</span>
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
            <Button variant="outline" size="sm" onClick={() => setMindmapOpen(true)} className="gap-1.5 text-xs">
              <GitBranch className="h-3.5 w-3.5" />思维导图
            </Button>
            <Link href={`/coach?kpId=${kp.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-blue-300 text-blue-600 hover:bg-blue-50">
                <Users className="h-3.5 w-3.5" />教练问答
              </Button>
            </Link>
            <Button
              variant={chatOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setChatOpen(!chatOpen)}
              className="gap-1.5 text-xs"
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

        {/* Post-mastery review prompt */}
        {showMasteryPrompt && kp.next && (
          <div className="mx-4 mb-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">🎯</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  已掌握！该知识点已加入复习队列
                </p>
                <p className="text-xs text-muted-foreground">
                  明天起可通过间隔重复来巩固记忆
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <Button
                size="sm"
                variant="outline"
                className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 h-8"
                onClick={() => {
                  setShowMasteryPrompt(false)
                  setPracticeDefaultTab("practice")
                  setLearningContentKey((k) => k + 1)
                }}
              >
                <PenLine className="h-3.5 w-3.5 mr-1" />
                趁热打铁做练习
              </Button>
              <Link href={`/courses/${kp.module.courseId}/learn/${kp.next.id}`}>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowMasteryPrompt(false)}>
                  继续下一个
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setShowMasteryPrompt(false)}
              >
                <X className="h-3.5 w-3.5" />
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

      {/* Module Completion Dialog */}
      <Dialog open={showCompletionPrompt} onOpenChange={setShowCompletionPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              模块学习完成！
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              你已经完成了「{kp.module.title}」模块的{(kp as any).moduleKpCount || ""}个知识点。太棒了！
            </p>
            <p className="text-sm">选择一个输出方式巩固所学：</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-3"
                onClick={async () => {
                  setCompletionAction("article")
                  setGenerating(true)
                  try {
                    const modRes = await fetch(`/api/modules/${kp.module.id}`)
                    const modData = await modRes.json()
                    const res = await fetch("/api/ai/generate-article", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        moduleId: kp.module.id,
                        courseTitle: kp.courseTitle,
                        moduleTitle: kp.module.title,
                      }),
                    })
                    const data = await res.json()
                    if (data.title) {
                      setGeneratedContent(data)
                      await fetch("/api/notes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: data.title,
                          content: data.content,
                          tags: ["learning-output"],
                        }),
                      })
                      toast.success("文章已生成并保存为笔记")
                    }
                  } catch { toast.error("文章生成失败") }
                  setGenerating(false)
                }}
                disabled={generating}
              >
                <FileText className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">撰写学习文章</p>
                  <p className="text-xs text-muted-foreground">生成一篇专业技术文章总结所学内容</p>
                </div>
                {generating && completionAction === "article" && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-3"
                onClick={async () => {
                  setCompletionAction("interview")
                  setGenerating(true)
                  try {
                    const res = await fetch("/api/ai/generate-questions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ knowledgePointId: kp.id, style: "interview" }),
                    })
                    const data = await res.json()
                    if (data.questions) {
                      setGeneratedContent({ title: "面试自检", content: data.questions.join("\n\n") })
                      toast.success("面试题已生成")
                    }
                  } catch { toast.error("题目生成失败") }
                  setGenerating(false)
                }}
                disabled={generating}
              >
                <MessageCircle className="h-5 w-5 text-purple-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">面试自检</p>
                  <p className="text-xs text-muted-foreground">生成面试风格的问题进行自我检测</p>
                </div>
                {generating && completionAction === "interview" && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
              </Button>
            </div>
            {generatedContent && (
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium mb-1">{generatedContent.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{generatedContent.content.slice(0, 300)}</p>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowCompletionPrompt(false)}>
              稍后再说
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mind Map Dialog */}
      <Dialog open={mindmapOpen} onOpenChange={setMindmapOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>思维导图 — {kp.module.title}</DialogTitle>
          </DialogHeader>
          <MindMapView moduleId={kp.module.id} />
        </DialogContent>
      </Dialog>

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
