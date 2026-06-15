"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { MarkdownContent } from "./markdown-content"
import { MermaidBlock } from "@/components/mermaid-block"
import { FileText, PenLine, Loader2, RotateCw, GraduationCap, GitGraph, FileDown } from "lucide-react"
import { toast } from "sonner"
import { PracticePanel } from "./practice-panel"
import { PodcastPlayer } from "./podcast-player"
import { LearningTabs } from "./learning-tabs"
import { parseContentLevels, hasContentForLevel, getContentForLevel } from "@/lib/ai/skills/content-levels"
import { buildPptxBlob } from "@/lib/pptx-builder"

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
  defaultTab?: ActiveTab
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

function parseSlidesFromMd(md: string): { title: string; bullets: string[] }[] {
  if (!md) return []
  const parts = md.split(/(?=^## )/m)
  const slides: { title: string; bullets: string[] }[] = []

  for (const part of parts) {
    const lines = part.trim().split("\n")
    const heading = lines[0]?.replace(/^## /, "").trim() || "概述"
    const body = lines.slice(1).join("\n").trim()

    // Extract bullet points
    const bulletLines = body
      .split("\n")
      .filter((l) => /^[-*]\s/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, "").trim())
      .filter((b) => b.length > 0)
      .slice(0, 8)

    if (bulletLines.length > 0) {
      slides.push({ title: heading, bullets: bulletLines })
    } else {
      // No bullets: use first paragraph split by sentences
      const cleaned = body.replace(/^#{1,4}\s.*$/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").trim()
      const sentences = cleaned.split(/[。！？]/).filter((s) => s.trim().length > 3).map((s) => s.trim()).slice(0, 6)
      slides.push({ title: heading, bullets: sentences.length > 0 ? sentences : [cleaned.slice(0, 200)] })
    }
  }

  return slides
}

async function downloadPptxBlob(title: string, md: string, courseTitle?: string) {
  const slides = parseSlidesFromMd(md)
  if (slides.length === 0) return
  const blob = await buildPptxBlob(slides, courseTitle)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${title}.pptx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "入门", label: "入门" },
  { value: "进阶", label: "进阶" },
  { value: "高阶", label: "高阶" },
]

export function LearningContent({ title, content: rawContent, knowledgePointId, moduleTitle, courseTitle, mastery, onMasteryChange, firstOpenedAt: initialFirstOpenedAt, completedAt: initialCompletedAt, defaultTab }: LearningContentProps) {
  const [tab, setTab] = useState<ActiveTab>(defaultTab ?? "content")
  const [difficulty, setDifficulty] = useState<Difficulty>("入门")
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState(false)
  const [diagramCode, setDiagramCode] = useState<string | null>(null)
  const [diagramOpen, setDiagramOpen] = useState(false)
  const [diagramGenerating, setDiagramGenerating] = useState(false)
  const [downloadingPpt, setDownloadingPpt] = useState(false)
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

  // 自动生成：当前难度无内容时触发（即使其他难度已有内容）
  useEffect(() => {
    if (hasContentForLevel(rawContent, difficulty) || enriching || enrichError || !knowledgePointId) return
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
  }, [rawContent, difficulty, knowledgePointId, title, moduleTitle, courseTitle])

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

  async function generateDiagram() {
    if (diagramGenerating || !knowledgePointId) return
    setDiagramGenerating(true)
    setDiagramOpen(true)
    setDiagramCode(null)
    try {
      const res = await fetch("/api/ai/generate-diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePointId }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      if (data.mermaid) {
        setDiagramCode(data.mermaid)
      } else {
        toast.error("图表生成失败")
        setDiagramOpen(false)
      }
    } catch {
      toast.error("图表生成失败")
      setDiagramOpen(false)
    }
    setDiagramGenerating(false)
  }

  async function handleDownloadPpt() {
    setDownloadingPpt(true)
    try {
      await downloadPptxBlob(title, currentContent, courseTitle || moduleTitle)
    } catch {
      toast.error("PPT导出失败")
    }
    setDownloadingPpt(false)
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
      <div className="flex items-center gap-1 border-b bg-card/50 px-2 sm:px-4 py-2 shrink-0 overflow-x-auto flex-nowrap">
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
            <div className="w-px h-5 bg-border mx-1" />
            <PodcastPlayer knowledgePointId={knowledgePointId} />
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={generateDiagram} disabled={diagramGenerating} className="gap-1.5 text-xs">
              {diagramGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitGraph className="h-3.5 w-3.5" />}
              图示
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={handleDownloadPpt} disabled={downloadingPpt} className="gap-1.5 text-xs">
              {downloadingPpt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              PPT
            </Button>
          </>
        )}
      </div>

      {/* Tab content */}
      {tab === "content" ? (
        <LearningTabs
          content={currentContent}
          renderSection={(sectionMd) => (
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>学习内容</span><span>·</span><span>AI 生成</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground/70 mb-6">
                {formatTime(firstOpenedAt) && <span>首次打开：{formatTime(firstOpenedAt)}</span>}
                {formatTime(completedAt) && <span>完成时间：{formatTime(completedAt)}</span>}
              </div>
              <h1 className="text-2xl font-bold mb-6">{title}</h1>
              <div className="text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none">
                <MarkdownContent content={sectionMd} />
              </div>
            </div>
          )}
        />
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

      {/* Diagram panel */}
      {diagramOpen && (
        <div className="border-t bg-card/30 shrink-0">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-card/50">
            <span className="text-xs font-medium text-muted-foreground">知识图示</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={generateDiagram} disabled={diagramGenerating} className="text-xs h-7">
                {diagramGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                重新生成
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDiagramOpen(false)} className="text-xs h-7">收起</Button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto px-6 py-4">
            {diagramGenerating && !diagramCode ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> AI 正在生成图表...
              </div>
            ) : diagramCode ? (
              <MermaidBlock code={diagramCode} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
