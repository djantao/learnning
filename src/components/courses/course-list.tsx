"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { GraduationCap, Plus, BookOpen, Sparkles, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Course {
  id: string; title: string; description: string | null; icon: string; color: string
  _count?: { modules: number }
}

export function CourseList({ initialCourses }: { initialCourses: Course[] }) {
  const [courses, setCourses] = useState(initialCourses)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [open, setOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

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

  async function aiGenerate() {
    if (!aiText.trim() || aiText.trim().length < 10) {
      toast.error("请输入至少 10 个字符的课程大纲")
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch("/api/ai/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: aiText }),
      })
      const data = await res.json()
      if (res.ok && data.course) {
        setCourses([data.course, ...courses])
        setAiText("")
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">我的课程</h2>
          <p className="text-muted-foreground">AI 教练驱动的体系化学习</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
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

        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI 生成课程
              </DialogTitle>
              <DialogDescription>
                粘贴结构化的课程大纲（支持 Markdown 表格、标题层级、嵌套列表等格式），AI 会自动解析并创建完整的课程结构。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Textarea
                className="min-h-[200px] max-h-[360px] font-mono text-sm"
                placeholder={`粘贴你的课程大纲，例如：

# Kafka 完整学习体系

| 模块 | 知识点 | 学习目标 |
|------|--------|----------|
| 前置知识 | 1. Linux基础<br>2. Java基础<br>3. 网络基础 | 补齐基础知识 |

或者：

- Python 入门
  - 基础语法
    - 变量与类型
    - 控制流
  - 函数与模块`}
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
              <Button onClick={aiGenerate} className="w-full" disabled={aiLoading}>
                {aiLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI 正在解析大纲...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    开始生成
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
