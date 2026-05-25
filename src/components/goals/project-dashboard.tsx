"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronRight, BookOpen, Clock, Target, ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import type { CourseStats, ModuleStats } from "@/lib/course-stats"

interface CourseEntry {
  courseId: string
  courseTitle: string
  goalTitle: string
  childGoalId: string
  stats: CourseStats
}

interface AvailableCourse {
  id: string
  title: string
}

interface ProjectDashboardProps {
  goal: {
    id: string
    title: string
    description: string | null
    status: string
    childGoals: any[]
  }
  courses: CourseEntry[]
  availableCourses: AvailableCourse[]
  totalEstimatedMinutes: number
  totalStudiedMinutes: number
  totalProgressPct: number
  totalPredictedDays: number | null
  totalKps: number
  totalMasteredKps: number
}

function formatHours(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

function formatPredicted(daysLeft: number | null, totalKps: number, masteredKps: number): string {
  if (totalKps === 0) return "--"
  if (masteredKps === 0) return "尚未开始"
  if (daysLeft === null || daysLeft === 0) return "即将完成"
  const d = new Date()
  d.setDate(d.getDate() + daysLeft)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function statusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge className="bg-green-500 hover:bg-green-600">已完成</Badge>
    case "in_progress": return <Badge className="bg-blue-500 hover:bg-blue-600">学习中</Badge>
    case "paused": return <Badge variant="secondary">暂停</Badge>
    default: return <Badge variant="outline">未开始</Badge>
  }
}

function ModuleRow({ mod, depth = 0 }: { mod: ModuleStats; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = mod.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
        style={{ paddingLeft: 16 + depth * 20 }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <div className="w-3.5" />
        )}
        <span className="flex-1 truncate">{mod.title}</span>
        {mod.totalKps > 0 && (
          <>
            <span className="text-xs text-muted-foreground w-10 text-right">{mod.progressPct}%</span>
            <Progress value={mod.progressPct} className="h-1.5 w-20" />
          </>
        )}
        <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
          {formatHours(mod.estimatedMinutes)}
          {mod.totalKps > 0 && ` · ${mod.masteredKps}/${mod.totalKps}`}
        </span>
      </div>
      {expanded && hasChildren && mod.children.map((c) => (
        <ModuleRow key={c.id} mod={c} depth={depth + 1} />
      ))}
    </div>
  )
}

export function ProjectDashboard({
  goal,
  courses,
  availableCourses,
  totalEstimatedMinutes,
  totalStudiedMinutes,
  totalProgressPct,
  totalPredictedDays,
  totalKps,
  totalMasteredKps,
}: ProjectDashboardProps) {
  const router = useRouter()
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(
    new Set(courses.map((c) => c.courseId))
  )
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<string>("")
  const [adding, setAdding] = useState(false)

  function toggleCourse(id: string) {
    const next = new Set(expandedCourses)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedCourses(next)
  }

  async function addCourse() {
    if (!selectedCourseId) return
    setAdding(true)
    try {
      const course = availableCourses.find(c => c.id === selectedCourseId)
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course?.title || "新课程",
          parentGoalId: goal.id,
          courseId: selectedCourseId,
        }),
      })
      toast.success("课程已添加")
      setAddDialogOpen(false)
      setSelectedCourseId("")
      router.refresh()
    } catch { toast.error("添加失败") }
    setAdding(false)
  }

  async function removeCourse(childGoalId: string) {
    try {
      await fetch(`/api/goals/${childGoalId}`, { method: "DELETE" })
      toast.success("课程已移除")
      router.refresh()
    } catch { toast.error("移除失败") }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/goals">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{goal.title}</h2>
            {statusBadge(goal.status)}
          </div>
          {goal.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{goal.description}</p>
          )}
        </div>
      </div>

      {/* Overall Stats */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{totalProgressPct}%</p>
              <p className="text-xs text-muted-foreground">总进度</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatHours(totalStudiedMinutes)}</p>
              <p className="text-xs text-muted-foreground">已学 / 预计 {formatHours(totalEstimatedMinutes)}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{courses.length}</p>
              <p className="text-xs text-muted-foreground">关联课程</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatPredicted(totalPredictedDays, totalKps, totalMasteredKps)}</p>
              <p className="text-xs text-muted-foreground">预计完成</p>
            </div>
          </div>
          <Progress value={totalProgressPct} className="h-2 mt-4" />
        </CardContent>
      </Card>

      {/* Course List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            课程列表
          </h3>
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 添加课程
          </Button>
        </div>

        {courses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">还没有关联课程</p>
              <Link href="/goals">
                <Button variant="outline" size="sm" className="mt-3">去目标管理关联课程</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          courses.map((entry) => {
            const s = entry.stats
            const isExpanded = expandedCourses.has(entry.courseId)

            return (
              <Card key={entry.courseId} className="group/course">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCourse(entry.courseId)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <Link href={`/courses/${entry.courseId}`} className="font-medium truncate hover:text-primary transition-colors">{entry.courseTitle}</Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatHours(s.studiedMinutes)} / {formatHours(s.estimatedMinutes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {s.progressPct}% · {s.masteredKps}/{s.totalKps} KP
                          </span>
                          {formatPredicted(s.predictedDaysLeft, s.totalKps, s.masteredKps) !== "--" && (
                            <span>{formatPredicted(s.predictedDaysLeft, s.totalKps, s.masteredKps)} 完成</span>
                          )}
                        </div>
                      </div>
                      <Progress value={s.progressPct} className="h-2 w-24 shrink-0" />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover/course:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => removeCourse(entry.childGoalId)}
                      title="移除此课程"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {isExpanded && s.modules.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      {s.modules.map((mod) => (
                        <ModuleRow key={mod.id} mod={mod} />
                      ))}
                    </div>
                  )}

                  {isExpanded && s.modules.length === 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                        还没有模块，先去课程页面添加
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Gantt Chart */}
      {courses.length > 0 && courses.some(c => c.stats.totalKps > 0) && (
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              项目时间线
            </h3>
            <div className="space-y-2">
              {(() => {
                const maxDays = Math.max(
                  ...courses.map(c => c.stats.predictedDaysLeft || 0),
                  courses.reduce((max, c) => Math.max(max, c.stats.totalKps > 0 ? Math.ceil(c.stats.totalKps / 0.5) : 0), 0),
                  30
                )
                const weeks = Math.ceil(maxDays / 7)
                const weekLabels = Array.from({ length: weeks }, (_, i) => `第${i + 1}周`)

                return (
                  <>
                    {/* Week headers */}
                    <div className="flex text-[10px] text-muted-foreground pl-32">
                      {weekLabels.map((label, i) => (
                        <div key={i} className="flex-1 text-center border-l border-muted first:border-l-0">{label}</div>
                      ))}
                    </div>
                    {/* Course bars */}
                    {courses.map(entry => {
                      const s = entry.stats
                      const totalDays = s.predictedDaysLeft || (s.totalKps > 0 ? Math.ceil(s.totalKps / 0.5) : maxDays)
                      const barWidth = Math.min((totalDays / (weeks * 7)) * 100, 100)
                      const completedWidth = s.totalKps > 0 ? (s.progressPct / 100) * barWidth : 0

                      return (
                        <div key={entry.courseId} className="flex items-center gap-2 text-xs">
                          <div className="w-32 truncate text-muted-foreground">{entry.courseTitle}</div>
                          <div className="flex-1 h-5 bg-muted rounded-sm relative overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-primary/60 rounded-sm"
                              style={{ width: `${completedWidth}%` }}
                            />
                            <div
                              className="absolute inset-y-0 left-0 border-r-2 border-primary rounded-sm"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-muted-foreground">
                            {formatPredicted(s.predictedDaysLeft, s.totalKps, s.masteredKps)}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Course Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加课程到项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">选择课程</label>
              <Select value={selectedCourseId} onValueChange={(v) => setSelectedCourseId(v || "")}>
                <SelectTrigger><SelectValue placeholder="选择一门课程..." /></SelectTrigger>
                <SelectContent>
                  {availableCourses
                    .filter(c => !courses.some(ec => ec.courseId === c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {availableCourses.filter(c => !courses.some(ec => ec.courseId === c.id)).length === 0 && (
                <p className="text-xs text-muted-foreground">所有课程已添加</p>
              )}
            </div>
            <Button onClick={addCourse} disabled={!selectedCourseId || adding} className="w-full">
              {adding ? "添加中..." : "添加课程"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
