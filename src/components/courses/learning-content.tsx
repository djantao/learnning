"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { renderMarkdown } from "@/lib/markdown"
import { FileText, PenLine, Loader2, RotateCw, GraduationCap } from "lucide-react"
import { toast } from "sonner"
import { PracticePanel } from "./practice-panel"

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
}

function isThinContent(content: string) {
  if (!content || content.trim().length === 0) return true
  if (content.includes("## ")) return false
  if (content.trim().length < 100) return true
  return false
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "入门", label: "入门" },
  { value: "进阶", label: "进阶" },
  { value: "高阶", label: "高阶" },
]

export function LearningContent({ title, content: initialContent, knowledgePointId, moduleTitle, courseTitle, mastery, onMasteryChange }: LearningContentProps) {
  const [tab, setTab] = useState<ActiveTab>("content")
  const [content, setContent] = useState(initialContent)
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>("入门")
  const openedRef = useRef(false)

  // Record first time opening this knowledge point's content
  useEffect(() => {
    if (openedRef.current || !initialContent || isThinContent(initialContent)) return
    openedRef.current = true
    fetch(`/api/knowledge-points/${knowledgePointId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstOpenedAt: new Date().toISOString() }),
    }).catch(() => {})
  }, [knowledgePointId, initialContent])

  useEffect(() => {
    if (!isThinContent(initialContent) || enriching || enrichError || !knowledgePointId) return
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
        if (!cancelled && data.content) setContent(data.content)
      } catch { if (!cancelled) setEnrichError(true) }
      if (!cancelled) setEnriching(false)
    }
    enrich()
    return () => { cancelled = true }
  }, [initialContent, knowledgePointId, title, moduleTitle, courseTitle])

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
      if (data.content) { setContent(data.content); toast.success(`已切换为${targetLevel}难度`) }
    } catch { toast.error("重新生成失败") }
    setEnriching(false)
  }

  const hasContent = content && content.trim().length > 0

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
        <Button variant="outline" size="sm" onClick={() => { setEnrichError(false); setContent(initialContent) }}>重试</Button>
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
                  onClick={() => { setDifficulty(opt.value); regenerateContent(opt.value) }}
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
              <span>学习内容</span><span>·</span><span>AI 生成</span>
            </div>
            <div className="text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none">
              {renderMarkdown(content)}
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
