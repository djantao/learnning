"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { GraduationCap, Plus, BookOpen, Sparkles, Loader2, Trash2, Search, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Course {
  id: string; title: string; description: string | null; icon: string; color: string
  _count?: { modules: number }
}

interface BookChapter {
  title: string
  description: string
  subChapters: string[]
}

interface BookOutline {
  courseTitle: string
  bookTitle: string
  chapters: BookChapter[]
}

export function CourseList({ initialCourses }: { initialCourses: Course[] }) {
  const [courses, setCourses] = useState(initialCourses)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [open, setOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMode, setAiMode] = useState<"outline" | "topic" | "book">("outline")
  const [aiText, setAiText] = useState("")
  const [aiTopicName, setAiTopicName] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [bookTitle, setBookTitle] = useState("")
  const [bookOutline, setBookOutline] = useState<BookOutline | null>(null)
  const [bookLoading, setBookLoading] = useState(false)
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set())

  // Version detection state
  const [detectedVersions, setDetectedVersions] = useState<string[]>([])
  const [versionRecommendation, setVersionRecommendation] = useState("")
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [detectingVersions, setDetectingVersions] = useState(false)
  const [showVersionPicker, setShowVersionPicker] = useState(false)

  async function createCourse() {
    if (!newTitle.trim()) return
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, description: newDesc || undefined }),
    })
    if (res.ok) {
      const course = await res.json()
      setCourses([course, ...courses])
      setNewTitle("")
      setNewDesc("")
      setOpen(false)
      toast.success("课程已创建")
    }
  }

  async function deleteCourse(id: string, title: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`确定要删除课程「${title}」吗？此操作不可撤销。`)) return
    const res = await fetch(`/api/courses/${id}`, { method: "DELETE" })
    if (res.ok) {
      setCourses(courses.filter((c) => c.id !== id))
      toast.success(`课程「${title}」已删除`)
    } else {
      toast.error("删除失败，请重试")
    }
  }

  async function searchBookOutline() {
    if (!bookTitle.trim() || bookTitle.trim().length < 2) {
      toast.error("请输入书名（至少2个字符）")
      return
    }
    setBookLoading(true)
    setBookOutline(null)
    setSelectedChapters(new Set())
    try {
      const res = await fetch("/api/ai/generate-book-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle: bookTitle.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.chapters) {
        setBookOutline(data)
        setSelectedChapters(new Set(data.chapters.map((_: BookChapter, i: number) => i)))
        toast.success(`已获取「${data.bookTitle}」的大纲`)
      } else {
        toast.error(data.error || "获取大纲失败")
      }
    } catch {
      toast.error("网络错误")
    }
    setBookLoading(false)
  }

  function toggleChapter(idx: number) {
    const next = new Set(selectedChapters)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setSelectedChapters(next)
  }

  function toggleAll() {
    if (!bookOutline) return
    if (selectedChapters.size === bookOutline.chapters.length) {
      setSelectedChapters(new Set())
    } else {
      setSelectedChapters(new Set(bookOutline.chapters.map((_, i) => i)))
    }
  }

  function buildBookOutlineText(): string {
    if (!bookOutline) return ""
    const selected = bookOutline.chapters.filter((_, i) => selectedChapters.has(i))
    return `# ${bookOutline.courseTitle}\n\n基于《${bookOutline.bookTitle}》\n\n` +
      selected.map((ch) =>
        `## ${ch.title}\n${ch.description}\n` +
        ch.subChapters.map((sc) => `- ${sc}`).join("\n")
      ).join("\n\n")
  }

  async function aiGenerate() {
    if (aiMode === "topic") {
      if (!aiTopicName.trim() || aiTopicName.trim().length < 2) {
        toast.error("请输入至少 2 个字符的课程主题")
        return
      }
    } else if (aiMode === "book") {
      if (!bookOutline || selectedChapters.size === 0) {
        toast.error("请先搜索书籍大纲并选择至少一个章节")
        return
      }
    } else {
      if (!aiText.trim() || aiText.trim().length < 10) {
        toast.error("请输入至少 10 个字符的课程大纲")
        return
      }
    }
    setAiLoading(true)
    try {
      const body = aiMode === "topic"
        ? { mode: "topic", topicName: aiTopicName.trim(), version: selectedVersion }
        : aiMode === "book"
          ? { rawText: buildBookOutlineText() }
          : { rawText: aiText }
      const res = await fetch("/api/ai/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.course) {
        setCourses([data.course, ...courses])
        setAiText("")
        setAiTopicName("")
        resetVersionState()
        setBookTitle("")
        setBookOutline(null)
        setSelectedChapters(new Set())
        setAiOpen(false)
        toast.success(`课程「${data.course.title}」已生成`)
      } else {
        toast.error(data.error || "生成失败，请重试")
      }
    } catch {
      toast.error("网络错误，请稍后重试")
    } finally {
      setAiLoading(false)
    }
  }

  function resetBookState() {
    setBookTitle("")
    setBookOutline(null)
    setSelectedChapters(new Set())
  }

  function resetVersionState() {
    setDetectedVersions([])
    setVersionRecommendation("")
    setSelectedVersion(null)
    setShowVersionPicker(false)
  }

  async function detectVersions() {
    const topic = aiTopicName.trim()
    if (!topic || topic.length < 2) {
      toast.error("请输入课程主题")
      return
    }
    setDetectingVersions(true)
    try {
      const res = await fetch("/api/ai/detect-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName: topic }),
      })
      const data = await res.json()
      if (data.hasVersions && data.versions.length > 0) {
        setDetectedVersions(data.versions)
        setVersionRecommendation(data.recommendation || "")
        setShowVersionPicker(true)
        toast.success(`检测到 ${data.versions.length} 个版本`)
      } else {
        setDetectedVersions([])
        setShowVersionPicker(false)
        toast.info("该主题无明确版本区分，将生成通用课程")
      }
    } catch {
      toast.error("版本检测失败")
    }
    setDetectingVersions(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">我的课程</h2>
          <p className="text-muted-foreground">AI 教练驱动的体系化学习</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setAiOpen(true); resetBookState() }}>
            <Sparkles className="mr-2 h-4 w-4" />
            AI 生成
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建课程
          </Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建课程</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">课程名称</p>
                <Input
                  placeholder="例如：Kafka 完整学习体系"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createCourse()}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">描述（可选）</p>
                <Input
                  placeholder="简要描述课程内容和目标"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createCourse()}
                />
              </div>
              <Button onClick={createCourse} className="w-full">创建</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { resetBookState(); resetVersionState() } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI 生成课程
              </DialogTitle>
              <DialogDescription>
                粘贴大纲让 AI 解析、输入主题让 AI 构建、或搜索书籍自动生成体系化课程。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Tabs value={aiMode} onValueChange={(v) => { setAiMode(v as typeof aiMode); resetBookState() }}>
                <TabsList variant="line" className="w-full">
                  <TabsTrigger value="outline" className="flex-1">📋 粘贴大纲</TabsTrigger>
                  <TabsTrigger value="topic" className="flex-1">💡 输入主题</TabsTrigger>
                  <TabsTrigger value="book" className="flex-1">📖 从书籍</TabsTrigger>
                </TabsList>

                <TabsContent value="outline" className="pt-4">
                  <Textarea
                    className="min-h-[200px] max-h-[360px] font-mono text-sm"
                    placeholder={`粘贴你的课程大纲，例如：

# Kafka 完整学习体系

| 模块 | 知识点 | 学习目标 |
|------|--------|----------|
| 前置知识 | 1. Linux基础<br>2. Java基础<br>3. 网络基础 | 补齐基础知识 |`}
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                  />
                </TabsContent>

                <TabsContent value="topic" className="pt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">输入你想学习的主题，AI 将自动构建完整的知识体系，覆盖从入门到进阶。</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="例如：Flink、Kubernetes、Rust、机器学习、Doris..."
                      value={aiTopicName}
                      onChange={(e) => { setAiTopicName(e.target.value); resetVersionState() }}
                      onKeyDown={(e) => e.key === "Enter" && aiGenerate()}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={detectVersions}
                      disabled={detectingVersions || !aiTopicName.trim() || aiTopicName.trim().length < 2}
                    >
                      {detectingVersions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      检测版本
                    </Button>
                  </div>

                  {showVersionPicker && detectedVersions.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <p className="text-sm font-medium">
                        检测到以下版本 {versionRecommendation && `· 推荐：${versionRecommendation}`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={selectedVersion === null ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                          onClick={() => setSelectedVersion(null)}
                        >
                          不指定版本
                        </Button>
                        {detectedVersions.map((v) => (
                          <Button
                            key={v}
                            variant={selectedVersion === v ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => setSelectedVersion(v)}
                          >
                            {v}
                          </Button>
                        ))}
                      </div>
                      {selectedVersion && (
                        <p className="text-xs text-primary">
                          已选择：{selectedVersion}，AI 将严格按此版本生成内容
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="book" className="pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">输入你想学习的书名，AI 将搜索该书的大纲并生成课程。</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="例如：数据密集型应用系统设计、深入理解计算机系统..."
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchBookOutline()}
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={searchBookOutline} disabled={bookLoading}>
                      {bookLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      搜索大纲
                    </Button>
                  </div>

                  {bookOutline && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
                        <div>
                          <p className="text-sm font-semibold">{bookOutline.courseTitle}</p>
                          <p className="text-xs text-muted-foreground">基于《{bookOutline.bookTitle}》· {bookOutline.chapters.length} 章</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                          {selectedChapters.size === bookOutline.chapters.length ? "取消全选" : "全选"}
                        </Button>
                      </div>
                      <div className="max-h-[320px] overflow-y-auto divide-y">
                        {bookOutline.chapters.map((ch, i) => (
                          <label
                            key={i}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${
                              selectedChapters.has(i) ? "bg-primary/5" : "opacity-60"
                            }`}
                          >
                            <Checkbox
                              checked={selectedChapters.has(i)}
                              onCheckedChange={() => toggleChapter(i)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {selectedChapters.has(i) && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                                <p className="text-sm font-medium">{ch.title}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{ch.description}</p>
                              {ch.subChapters.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {ch.subChapters.map((sc, j) => (
                                    <span key={j} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                      {sc}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
                        已选 {selectedChapters.size}/{bookOutline.chapters.length} 章
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Button onClick={aiGenerate} className="w-full" disabled={aiLoading || (aiMode === "book" && (!bookOutline || selectedChapters.size === 0))}>
                {aiLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {aiMode === "topic" ? "AI 正在构建知识体系..." : aiMode === "book" ? "AI 正在生成课程..." : "AI 正在解析大纲..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {aiMode === "topic" ? "生成体系化课程" : aiMode === "book" ? `生成课程（${selectedChapters.size}章）` : "开始生成"}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">还没有课程</h3>
            <p className="mt-1 text-sm text-muted-foreground">创建你的第一个课程，让 AI 教练帮你体系化学习</p>
            <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              创建第一门课程
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div key={course.id} className="relative group">
              <Link href={`/courses/${course.id}`}>
                <Card className="cursor-pointer transition-colors hover:border-primary h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span>{course.icon}</span>
                      {course.title}
                    </CardTitle>
                    {course.description && (
                      <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{course._count?.modules ?? 0} 个模块</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => deleteCourse(course.id, course.title, e)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
