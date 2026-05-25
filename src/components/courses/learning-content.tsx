"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { renderMarkdown } from "@/lib/markdown"
import { FileText, PenLine, Loader2, RotateCw, GraduationCap } from "lucide-react"
import { toast } from "sonner"
import { PracticePanel } from "./practice-panel"
import { parseContentLevels, hasContentForLevel, getContentForLevel } from "@/lib/ai/skills/content-levels"

type ActiveTab = "content" | "practice"
type Difficulty = "入门" | "进阶" | "高阶"

interface LearningContentProps {
  title: string
  content: string
  knowledgePointId: string
  moduleTitle?: string
  courseTitle?: string
  mastery: number
  onMasteryChange: (value: number) => void
  firstOpenedAt?: string | null
  completedAt?: string | null
}

function isThinContent(content: string) {
  if (!content || content.trim().length === 0) return true
  if (content.includes("## ")) return false
  if (content.trim().length < 100) return true
  return false
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "入门", label: "入门" },
  { value: "进阶", label: "进阶" },
  { value: "高阶", label: "高阶" },
]

export function LearningContent({ title, content: rawContent, knowledgePointId, moduleTitle, courseTitle, mastery, onMasteryChange, firstOpenedAt: initialFirstOpenedAt, completedAt: initialCompletedAt }: LearningContentProps) {
  const [tab, setTab] = useState<ActiveTab>("content")
  const [difficulty, setDifficulty] = useState<Difficulty>("入门")
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState(false)
  const [firstOpenedAt, setFirstOpenedAt] = useState<string | null>(initialFirstOpenedAt ?? null)
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt ?? null)
  const openedRef = useRef(false)
  const completedRef = useRef(false)

  // 从原始 content 字段解析出当前难度的内容
  const currentContent = getContentForLevel(rawContent, difficulty) || ""
  const hasAnyContent = !!(getContentForLevel(rawContent, "入门") || getContentForLevel(rawContent, "进阶") || getContentForLevel(rawContent, "高阶"))

  // Record first time opening this knowledge point's content
  useEffect(() => {
    if (openedRef.current || !hasAnyContent || isThinContent(currentContent)) return
    openedRef.current = true
    const now = new Date().toISOString()
    setFirstOpenedAt(now)
    fetch(`/api/knowledge-points/${knowledgePointId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstOpenedAt: now }),
    }).catch(() => {})
  }, [knowledgePointId, hasAnyContent])

  // Track completedAt from initial prop and auto-set when mastery reaches threshold
  useEffect(() => {
    if (initialCompletedAt && !completedRef.current) {
      completedRef.current = true
      setCompletedAt(initialCompletedAt)
    }
  }, [initialCompletedAt])

  useEffect(() => {
    if (completedRef.current || mastery < 4 || !knowledgePointId) return
    completedRef.current = true
    const now = new Date().toISOString()
    setCompletedAt(now)
    fetch(`/api/knowledge-points/${knowledgePointId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: now }),
    }).catch(() => {})
  }, [mastery, knowledgePointId])

  // 自动生成：仅在没有任何难度有内容时才触发
  useEffect(() => {
    if (hasAnyContent || enriching || enrichError || !knowledgePointId) return
    let cancelled = false
    setEnriching(true)
    async function enrich() {
      try {
        const res = await fetch("/api/ai/enrich-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knowledgePointId, title, moduleTitle: moduleTitle || "", courseTitle: courseTitle || "", level: difficulty }),
        })
        if (!res.ok || cancelled) { setEnrichError(true); setEnriching(false); return }
        const data = await res.json()
        if (!cancelled && data.content) window.location.reload()
      } catch { if (!cancelled) setEnrichError(true) }
      if (!cancelled) setEnriching(false)
    }
    enrich()
    return () => { cancelled = true }
  }, [hasAnyContent, knowledgePointId, title, moduleTitle, courseTitle])

  async function switchDifficulty(level: Difficulty) {
    setDifficulty(level)
    // 如果新难度已有缓存内容，直接切换显示，不调 API
    if (hasContentForLevel(rawContent, level)) return
    // 否则触发生成
    await regenerateContent(level)
  }

  async function regenerateContent(level?: Difficulty) {
    if (enriching || !knowledgePointId) return
    const targetLevel = level ?? difficulty
    setEnriching(true)
    try {
      const res = await fetch("/api/ai/enrich-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePointId, title, moduleTitle: moduleTitle || "", courseTitle: courseTitle || "", level: targetLevel, regenerate: true }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      if (data.content) { toast.success(`已切换为${targetLevel}难度`); window.location.reload() }
    } catch { toast.error("重新生成失败") }
    setEnriching(false)
  }

  const hasContent = currentContent && currentContent.trim().length > 0

  if (enriching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">AI 正在生成学习内容...</p>
      </div>
    )
  }

  if (enrichError && !hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-sm text-muted-foreground">内容生成失败</p>
        <Button variant="outline" size="sm" onClick={() => { setEnrichError(false); window.location.reload() }}>重试</Button>
      </div>
    )
  }

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <p>暂无学习内容</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab toolbar */}
      <div className="flex items-center gap-1 border-b bg-card/50 px-4 py-2 shrink-0">
        <Button
          variant={tab === "content" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("content")}
          className="gap-1.5 text-xs"
        >
          <FileText className="h-3.5 w-3.5" />
          内容
        </Button>
        <Button
          variant={tab === "practice" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("practice")}
          className="gap-1.5 text-xs"
        >
          <PenLine className="h-3.5 w-3.5" />
          做题
        </Button>
        {tab === "content" && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={() => regenerateContent()} disabled={enriching} className="gap-1.5 text-xs">
              {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              重新生成
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex items-center gap-0.5">
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground mr-1" />
              {DIFFICULTY_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={difficulty === opt.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => switchDifficulty(opt.value)}
                  disabled={enriching}
                  className="text-xs h-7 px-2"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tab content */}
      {tab === "content" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <h1 className="text-2xl font-bold mb-2">{title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>学习内容</span><span>·</span><span>AI 生成</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground/70 mb-6">
              {formatTime(firstOpenedAt) && <span>首次打开：{formatTime(firstOpenedAt)}</span>}
              {formatTime(completedAt) && <span>完成时间：{formatTime(completedAt)}</span>}
            </div>
            <div className="text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none">
              {renderMarkdown(currentContent)}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <PracticePanel
            knowledgePointId={knowledgePointId}
            kpTitle={title}
            mastery={mastery}
            onMasteryChange={onMasteryChange}
          />
        </div>
      )}
    </div>
  )
}
