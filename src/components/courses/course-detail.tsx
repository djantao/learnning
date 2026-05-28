"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ChevronRight, ChevronDown, Plus, GraduationCap, Play, Pencil, Loader2, Clock, Target, CalendarClock, ClipboardCheck,
} from "lucide-react"
import type { CourseStats } from "@/lib/course-stats"
import { masteryLabel } from "@/lib/mastery"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import Link from "next/link"

interface KP {
  id: string; title: string; status: string; mastery: number; sortOrder: number
}

interface Module {
  id: string; title: string; description: string | null; status: string
  progressPct: number; sortOrder: number
  estimatedMinutes: number | null; scheduledDate: string | null
  childModules: Module[]
  knowledgePoints: KP[]
}

interface Course {
  id: string; title: string; description: string | null; icon: string; color: string
  modules: Module[]
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

function totalModuleMinutes(mod: Module): number {
  let total = mod.estimatedMinutes ?? 0
  for (const child of mod.childModules) {
    total += totalModuleMinutes(child)
  }
  return total
}

export function CourseDetail({ course: initialCourse, stats }: { course: Course; stats?: CourseStats }) {
  const router = useRouter()
  const [course] = useState(initialCourse)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingModule, setAddingModule] = useState<string | null>(null)
  const [moduleName, setModuleName] = useState("")
  const [addingKP, setAddingKP] = useState<string | null>(null)
  const [kpName, setKpName] = useState("")
  const [estimating, setEstimating] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [dailyMinutes, setDailyMinutes] = useState("120")
  const [scheduling, setScheduling] = useState(false)
  const [clearingSchedule, setClearingSchedule] = useState(false)

  async function clearSchedule() {
    setClearingSchedule(true)
    try {
      const res = await fetch(`/api/courses/${course.id}/schedule`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.cleared > 0 ? `已清除 ${data.cleared} 个模块的排期` : "没有排期需要清除")
        router.refresh()
      } else {
        toast.error(data.error || "清除失败")
      }
    } catch { toast.error("清除失败") }
    setClearingSchedule(false)
  }

  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpanded(next)
  }

  async function createModule(parentModuleId: string | null) {
    if (!moduleName.trim()) return
    const res = await fetch(`/api/courses/${course.id}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: moduleName, parentModuleId }),
    })
    if (res.ok) {
      toast.success("模块已创建")
      setModuleName("")
      setAddingModule(null)
      router.refresh()
    }
  }

  async function doSchedule() {
    if (!dailyMinutes || parseInt(dailyMinutes) < 10) return
    setScheduling(true)
    try {
      const res = await fetch(`/api/courses/${course.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyStudyMinutes: parseInt(dailyMinutes) }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `已为 ${data.scheduled} 个模块排期`)
        setScheduleOpen(false)
        router.refresh()
      } else {
        toast.error(data.error || "排期失败")
      }
    } catch { toast.error("排期失败") }
    setScheduling(false)
  }

  async function createKP(moduleId: string) {
    if (!kpName.trim()) return
    const res = await fetch(`/api/modules/${moduleId}/knowledge-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: kpName }),
    })
    if (res.ok) {
      toast.success("知识点已创建")
      setKpName("")
      setAddingKP(null)
      router.refresh()
    }
  }

  const statusLabel = (s: string) =>
    s === "completed" ? "已完成" : s === "in_progress" ? "学习中" : "未开始"

  function renderModule(mod: Module, depth: number) {
    const isExpanded = expanded.has(mod.id)
    const hasChildren = mod.childModules.length > 0 || mod.knowledgePoints.length > 0

    return (
      <div key={mod.id} className="space-y-2" style={{ marginLeft: depth * 20 }}>
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {hasChildren ? (
                  <button onClick={() => toggle(mod.id)} className="shrink-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                ) : (
                  <span className="w-4" />
                )}
                <CardTitle className="text-sm font-medium truncate" title={mod.title}>{mod.title}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{statusLabel(mod.status)}</Badge>
                {(() => {
                  const total = totalModuleMinutes(mod)
                  if (total > 0) {
                    return <span className="text-[10px] text-muted-foreground">~{total}分钟</span>
                  }
                  return null
                })()}
                {mod.scheduledDate && (
                  <span className="text-[10px] text-primary/70">{new Date(mod.scheduledDate).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
                )}
                {mod.progressPct > 0 && (
                  <span className="text-xs text-muted-foreground">{mod.progressPct}%</span>
                )}
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Link href={`/courses/${course.id}/quiz/${mod.id}`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="模块测验">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => { setAddingKP(mod.id); setKpName("") }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => { setAddingModule(mod.id); setModuleName("") }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {mod.progressPct > 0 && <Progress value={mod.progressPct} className="h-1.5 mt-2" />}
          </CardHeader>
        </Card>

        {addingKP === mod.id && (
          <div className="flex gap-2" style={{ marginLeft: 24 }}>
            <Input placeholder="知识点名称..." className="h-8 text-xs"
              value={kpName} onChange={(e) => setKpName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createKP(mod.id)} />
            <Button size="sm" className="h-8 text-xs" onClick={() => createKP(mod.id)}>添加</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingKP(null)}>取消</Button>
          </div>
        )}

        {addingModule === mod.id && (
          <div className="flex gap-2" style={{ marginLeft: 24 }}>
            <Input placeholder="子模块名称..." className="h-8 text-xs"
              value={moduleName} onChange={(e) => setModuleName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createModule(mod.id)} />
            <Button size="sm" className="h-8 text-xs" onClick={() => createModule(mod.id)}>添加</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingModule(null)}>取消</Button>
          </div>
        )}

        {isExpanded && mod.knowledgePoints.map((kp) => (
          <Link key={kp.id} href={`/courses/${course.id}/learn/${kp.id}`}>
            <Card className="cursor-pointer transition-colors hover:border-primary ml-8">
              <CardContent className="flex items-center justify-between py-2.5 px-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Play className="h-3 w-3 shrink-0 text-primary" />
                  <span className="text-sm truncate" title={kp.title}>{kp.title}</span>
                </div>
                {(() => {
                  const m = masteryLabel(kp.mastery)
                  const cls = m.color === "green" ? "bg-green-500 hover:bg-green-600" : m.color === "amber" ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"
                  return <Badge className={`text-[10px] ${cls}`}>{m.label}</Badge>
                })()}
              </CardContent>
            </Card>
          </Link>
        ))}

        {isExpanded && mod.childModules.map((child) => renderModule(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground">课程</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <span>{course.icon}</span>
            {course.title}
          </h2>
          {course.description && <p className="text-muted-foreground">{course.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm"
            onClick={async () => {
              setEstimating(true)
              try {
                const res = await fetch("/api/ai/estimate-times", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ courseId: course.id }),
                })
                const data = await res.json()
                toast.success(data.message || "时长已估算")
                router.refresh()
              } catch { toast.error("估算失败") }
              setEstimating(false)
            }}
            disabled={estimating}
          >
            {estimating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Clock className="mr-1 h-3.5 w-3.5" />}
            AI 估算时长
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => { setAddingModule("root"); setModuleName("") }}>
            <Plus className="mr-2 h-4 w-4" />新建模块
          </Button>
        </div>
      </div>

      {stats && stats.totalKps > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{stats.progressPct}%</p>
                <p className="text-xs text-muted-foreground">总进度</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatHours(stats.studiedMinutes)}</p>
                <p className="text-xs text-muted-foreground">已学 / 预计 {formatHours(stats.estimatedMinutes)}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.masteredKps}<span className="text-base text-muted-foreground">/{stats.totalKps}</span></p>
                <p className="text-xs text-muted-foreground">已掌握知识点</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatPredicted(stats.predictedDaysLeft, stats.totalKps, stats.masteredKps)}</p>
                <p className="text-xs text-muted-foreground">预计完成</p>
              </div>
            </div>
            <Progress value={stats.progressPct} className="h-2 mt-4" />
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" size="sm" className="gap-1"
                onClick={() => setScheduleOpen(true)}>
                <CalendarClock className="h-3.5 w-3.5" />
                自动排期
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground"
                onClick={clearSchedule} disabled={clearingSchedule}>
                {clearingSchedule ? "清除中..." : "清除排期"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {addingModule === "root" && (
        <Card>
          <CardContent className="flex gap-2 py-3">
            <Input placeholder="模块名称..." className="h-9"
              value={moduleName} onChange={(e) => setModuleName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createModule(null)} />
            <Button size="sm" onClick={() => createModule(null)}>添加</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingModule(null); setModuleName("") }}>取消</Button>
          </CardContent>
        </Card>
      )}

      {course.modules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">还没有模块</h3>
            <p className="mt-1 text-sm text-muted-foreground">为课程创建第一个学习模块</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {course.modules.map((mod) => renderModule(mod, 0))}
        </div>
      )}

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>自动排期 — {course.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">每日计划学习时长（分钟）</label>
              <Input
                type="number"
                min="10"
                step="10"
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(e.target.value)}
                placeholder="例如：120（2小时）"
              />
              <p className="text-xs text-muted-foreground">
                算法将按模块树的顺序，每天安排不超过此时长的模块。
              </p>
            </div>
            <Button onClick={doSchedule} disabled={scheduling || !dailyMinutes} className="w-full">
              {scheduling ? "排期中..." : "开始排期"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
