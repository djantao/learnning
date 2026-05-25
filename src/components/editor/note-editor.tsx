"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Plus, Save, ArrowLeft, Eye, Brain, Sparkles, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Section {
  id: string
  name: string
  notebookId: string
}

interface Notebook {
  id: string
  name: string
  sections: Section[]
}

interface NoteLink {
  targetPage?: { id: string; title: string; slug: string }
  sourcePage?: { id: string; title: string; slug: string }
}

interface NoteData {
  id: string
  title: string
  content: string
  sectionId: string | null
  section?: { id: string; name: string; notebookId: string } | null
  tags: { tag: { id: string; name: string } }[]
  linksFrom?: NoteLink[]
  linksTo?: NoteLink[]
  slug?: string
}

interface Props {
  notebooks: Notebook[]
  initialNote?: NoteData | null
}

export function NoteEditor({ notebooks, initialNote }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialNote?.title ?? "")
  const [content, setContent] = useState(initialNote?.content ?? "")
  const [sectionId, setSectionId] = useState<string | null>(initialNote?.sectionId ?? null)
  const [tags, setTags] = useState<string[]>(initialNote?.tags?.map((t) => t.tag.name) ?? [])
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const isNew = !initialNote?.id

  // Auto-save
  const doSave = useCallback(async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const url = isNew ? "/api/notes" : `/api/notes/${initialNote!.id}`
      const method = isNew ? "POST" : "PUT"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, sectionId: sectionId || null, tags }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setLastSaved(new Date())
      if (isNew && data.id) {
        router.replace(`/notes/${data.id}`)
      }
      toast.success("已保存")
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }, [title, content, sectionId, tags, isNew, initialNote, router])

  useEffect(() => {
    if (!initialNote) return
    const handler = setTimeout(() => {
      if (title !== initialNote.title || content !== initialNote.content) {
        doSave()
      }
    }, 3000)
    return () => clearTimeout(handler)
  }, [title, content, sectionId, tags])

  // Keyboard shortcut: Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        doSave()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [doSave])

  function addTag() {
    const name = tagInput.trim()
    if (name && !tags.includes(name)) {
      setTags([...tags, name])
    }
    setTagInput("")
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name))
  }

  async function generateFlashcards() {
    if (!initialNote?.id) return
    setAiLoading("flashcards")
    try {
      const res = await fetch("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: initialNote.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`成功生成 ${data.count} 张闪卡`)
      } else {
        toast.error(data.error || "生成失败，请检查 AI API 配置")
      }
    } catch {
      toast.error("AI 服务暂不可用")
    } finally {
      setAiLoading(null)
    }
  }

  async function summarizeNote() {
    if (!initialNote?.id) return
    setAiLoading("summarize")
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: initialNote.id, noteContent: content, noteTitle: title }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("摘要已生成")
      } else {
        toast.error(data.error || "摘要生成失败")
      }
    } catch {
      toast.error("AI 服务暂不可用")
    } finally {
      setAiLoading(null)
    }
  }

  async function findRelatedNotes() {
    if (!initialNote?.id) return
    const linksSection = document.getElementById("links-sidebar")
    if (linksSection) {
      linksSection.scrollIntoView({ behavior: "smooth" })
      toast.info("查看右侧「链接」面板")
    } else {
      toast.info("暂无关联笔记")
    }
  }

  // Get section display info
  const selectedNotebook = sectionId
    ? notebooks.find((n) => n.sections.some((s) => s.id === sectionId))
    : null
  const selectedSection = sectionId
    ? notebooks.flatMap((n) => n.sections).find((s) => s.id === sectionId)
    : null

  return (
    <div className="flex gap-6">
      {/* Main Editor */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/notebooks">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="笔记标题..."
              className="text-xl font-bold border-none px-0 h-auto focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-muted-foreground">
                已保存 {lastSaved.toLocaleTimeString("zh-CN")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
              {preview ? <><FileText className="mr-1 h-4 w-4" />编辑</> : <><Eye className="mr-1 h-4 w-4" />预览</>}
            </Button>
            <Button size="sm" onClick={doSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>

        {/* Section selector */}
        <div className="flex items-center gap-4">
          <Select value={sectionId || ""} onValueChange={(v) => setSectionId(v || null)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择笔记本/章节" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">未分类</SelectItem>
              {notebooks.map((nb) => (
                <SelectGroup key={nb.id}>
                  <SelectLabel>{nb.name}</SelectLabel>
                  {nb.sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {selectedNotebook && selectedSection && (
            <span className="text-sm text-muted-foreground">
              {selectedNotebook.name} / {selectedSection.name}
            </span>
          )}
        </div>

        {/* Tag input */}
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(tag)}>
              {tag}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
            placeholder="添加标签..."
            className="h-7 w-32 border-dashed text-xs"
          />
          {tagInput && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addTag}>
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Content */}
        {preview ? (
          <Card className="min-h-[400px]">
            <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6">
              <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }} />
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">编辑</TabsTrigger>
              <TabsTrigger value="preview">预览</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="开始写笔记... 支持 Markdown 语法。使用 [[笔记名]] 创建双向链接。"
                className="min-h-[500px] font-mono text-sm resize-y"
              />
            </TabsContent>
            <TabsContent value="preview">
              <Card className="min-h-[500px]">
                <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6">
                  <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="hidden w-64 space-y-4 xl:block shrink-0">
        {/* AI Actions */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-sm">AI 操作</h3>
            <Button
              variant="outline" size="sm" className="w-full justify-start"
              onClick={generateFlashcards}
              disabled={!initialNote?.id || aiLoading === "flashcards"}
            >
              {aiLoading === "flashcards" ? (
                <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Sparkles className="mr-2 h-3 w-3" />
              )}
              生成闪卡
            </Button>
            <Button
              variant="outline" size="sm" className="w-full justify-start"
              onClick={summarizeNote}
              disabled={!initialNote?.id || aiLoading === "summarize"}
            >
              {aiLoading === "summarize" ? (
                <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Brain className="mr-2 h-3 w-3" />
              )}
              总结笔记
            </Button>
            <Button
              variant="outline" size="sm" className="w-full justify-start"
              onClick={findRelatedNotes}
              disabled={!initialNote?.id}
            >
              <FileText className="mr-2 h-3 w-3" />
              查看链接
            </Button>
          </CardContent>
        </Card>

        {/* Links */}
        {initialNote && (
          <Card id="links-sidebar">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">链接</h3>
              {initialNote.linksFrom && initialNote.linksFrom.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">出链</p>
                  {initialNote.linksFrom.map((link) => (
                    <Link
                      key={link.targetPage!.id}
                      href={`/notes/${link.targetPage!.id}`}
                      className="block text-sm text-primary hover:underline"
                    >
                      → {link.targetPage!.title}
                    </Link>
                  ))}
                </div>
              )}
              {initialNote.linksTo && initialNote.linksTo.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">反向链接</p>
                  {initialNote.linksTo.map((link) => (
                    <Link
                      key={link.sourcePage!.id}
                      href={`/notes/${link.sourcePage!.id}`}
                      className="block text-sm text-primary hover:underline"
                    >
                      ← {link.sourcePage!.title}
                    </Link>
                  ))}
                </div>
              )}
              {(!initialNote.linksFrom?.length && !initialNote.linksTo?.length) && (
                <p className="text-xs text-muted-foreground">暂无链接</p>
              )}
              <Link href={`/notes/${initialNote.id}/graph`} className="block">
                <Button variant="ghost" size="sm" className="w-full">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  查看知识图谱
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Very basic Markdown→HTML converter for preview
function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Wiki links
    .replace(/\[\[([^\]]+)\]\]/g, '<a href="#" class="wiki-link">$1</a>')
    // Regular links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Paragraphs
    .replace(/\n\n/g, "</p><p>")
  return "<p>" + html + "</p>"
}
