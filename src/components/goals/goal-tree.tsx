"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Target, Trash2, FileText, ChevronDown, ChevronRight, RefreshCw, ExternalLink, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Material {
  id: string
  pageId: string | null
  resourceUrl: string | null
  resourceTitle: string | null
  isCompleted: boolean
  page?: { id: string; title: string; slug: string } | null
}

interface Goal {
  id: string
  title: string
  description: string | null
  status: string
  progressPct: number
  childGoals: Goal[]
  materials: Material[]
}

interface Page { id: string; title: string; slug: string }

interface Course { id: string; title: string }

export function GoalTree({ initialGoals, availablePages, courses }: { initialGoals: Goal[]; availablePages: Page[]; courses: Course[] }) {
  const router = useRouter()
  const [goals, setGoals] = useState(initialGoals)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(goals.map((g) => g.id)))
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [parentGoalId, setParentGoalId] = useState<string | null>(null)
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set())
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editCourseIds, setEditCourseIds] = useState<string[]>([])
  const [editing, setEditing] = useState(false)

  function toggleExpand(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) { next["delete"](id) } else { next.add(id) }
    setExpanded(next)
  }

  async function createGoal() {
    if (!title.trim()) return
    const firstCourse = courseIds[0] || null
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, parentGoalId, courseId: firstCourse }),
    })
    if (res.ok) {
      const data = await res.json()
      // Create child goals for additional courses
      for (let i = 1; i < courseIds.length; i++) {
        await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: courses.find(c => c.id === courseIds[i])?.title || `课程 ${i + 1}`, parentGoalId: data.id, courseId: courseIds[i] }),
        })
      }
      if (parentGoalId) {
        setGoals(goals.map((g) => addChildGoal(g, parentGoalId, { ...data, childGoals: [], materials: [] })))
      } else {
        setGoals([...goals, { ...data, childGoals: [], materials: [] }])
      }
      setTitle(""); setDescription(""); setCourseIds([]); setNewDialogOpen(false)
      toast.success("目标已创建")
      router.refresh()
    }
  }

  function addChildGoal(goal: Goal, parentId: string, newGoal: Goal): Goal {
    if (goal.id === parentId) return { ...goal, childGoals: [...goal.childGoals, newGoal] }
    return { ...goal, childGoals: goal.childGoals.map((c) => addChildGoal(c, parentId, newGoal)) }
  }

  async function refreshGoal(goalId: string) {
    setRefreshing((prev) => new Set(prev).add(goalId))
    try {
      const res = await fetch(`/api/goals/${goalId}`)
      const data = await res.json()
      const update = (gs: Goal[]): Goal[] =>
        gs.map((g) => g.id === goalId ? { ...g, progressPct: data.progressPct, status: data.status, childGoals: g.childGoals } : { ...g, childGoals: update(g.childGoals) })
      setGoals(update(goals))
      toast.success("进度已刷新")
    } catch {
      toast.error("刷新失败")
    } finally {
      setRefreshing((prev) => { const n = new Set(prev); n.delete(goalId); return n })
    }
  }

  async function deleteGoal(goalId: string) {
    await fetch(`/api/goals/${goalId}`, { method: "DELETE" })
    const remove = (gs: Goal[]): Goal[] =>
      gs.filter((g) => g.id !== goalId).map((g) => ({ ...g, childGoals: remove(g.childGoals) }))
    setGoals(remove(goals))
    toast.success("目标已删除")
  }

  async function addMaterial(goalId: string, pageId: string) {
    const res = await fetch(`/api/goals/${goalId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    })
    if (res.ok) {
      const data = await res.json()
      const add = (gs: Goal[]): Goal[] =>
        gs.map((g) => g.id === goalId ? { ...g, materials: [...g.materials, { ...data, page: availablePages.find((p) => p.id === pageId) }] } : { ...g, childGoals: add(g.childGoals) })
      setGoals(add(goals))
      toast.success("学习材料已关联")
      router.refresh()
    }
  }

  async function toggleMaterial(goalId: string, materialId: string, isCompleted: boolean) {
    await fetch(`/api/goals/${goalId}/materials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialId, isCompleted }),
    })
    const toggle = (gs: Goal[]): Goal[] =>
      gs.map((g) => ({
        ...g,
        materials: g.materials.map((m) => m.id === materialId ? { ...m, isCompleted } : m),
        childGoals: toggle(g.childGoals),
      }))
    setGoals(toggle(goals))
    router.refresh()
  }

  async function saveEdit() {
    if (!editGoalId || !editTitle.trim()) return
    setEditing(true)
    try {
      await fetch(`/api/goals/${editGoalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, courseId: editCourseIds[0] || null }),
      })
      toast.success("目标已更新")
      setEditDialogOpen(false)
      router.refresh()
    } catch { toast.error("更新失败") }
    setEditing(false)
  }

  function openEdit(goal: Goal) {
    setEditGoalId(goal.id)
    setEditTitle(goal.title)
    setEditCourseIds([])
    setEditDialogOpen(true)
  }

  const statusBadge = useCallback((status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-500 hover:bg-green-600">已完成</Badge>
      case "in_progress": return <Badge className="bg-blue-500 hover:bg-blue-600">学习中</Badge>
      case "paused": return <Badge variant="secondary">暂停</Badge>
      default: return <Badge variant="outline">未开始</Badge>
    }
  }, [])

  function progressHint(goal: Goal): string {
    if (goal.childGoals.length > 0) {
      return `${goal.childGoals.length} 个子目标平均`
    }
    if (goal.materials.length > 0) {
      return `基于 ${goal.materials.length} 个学习材料的闪卡掌握率`
    }
    return "添加学习材料或子目标后自动计算"
  }

  function renderGoal(goal: Goal, depth = 0) {
    const isExpanded = expanded.has(goal.id)
    const hasChildren = goal.childGoals.length > 0
    const isRefreshing = refreshing.has(goal.id)

    return (
      <div key={goal.id} className="space-y-2">
        <Card className={`${depth > 0 ? "ml-6" : ""} group`}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              {hasChildren ? (
                <button onClick={() => toggleExpand(goal.id)} className="mt-0.5 text-muted-foreground hover:text-foreground">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : depth > 0 ? <div className="w-4" /> : null}

              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/goals/${goal.id}`} className="font-medium hover:text-primary transition-colors">{goal.title}</Link>
                  {statusBadge(goal.status)}
                </div>
                {goal.description && <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>}

                {/* Progress bar */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <Progress value={goal.progressPct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(goal.progressPct)}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">{progressHint(goal)}</p>
                </div>

                {/* Materials list */}
                {goal.materials.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {goal.materials.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={m.isCompleted}
                          onCheckedChange={(v) => toggleMaterial(goal.id, m.id, !!v)}
                          className="h-3 w-3"
                        />
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        {m.page ? (
                          <Link href={`/notes/${m.page.id}`} className="hover:underline text-primary truncate">
                            {m.page.title}
                          </Link>
                        ) : m.resourceUrl ? (
                          <a href={m.resourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary flex items-center gap-1 truncate">
                            {m.resourceTitle || m.resourceUrl} <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Link href={`/goals/${goal.id}`}>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    查看 <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </Link>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Select value="" onValueChange={(v) => v && addMaterial(goal.id, v)}>
                    <SelectTrigger className="h-7 w-7 p-0 border-0" title="关联笔记">
                      <Plus className="h-3.5 w-3.5" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePages.length === 0 ? (
                        <div className="px-2 py-4 text-xs text-muted-foreground text-center">暂无笔记</div>
                      ) : (
                        availablePages.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(goal)} title="编辑目标">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refreshGoal(goal.id)} disabled={isRefreshing} title="刷新进度">
                    {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteGoal(goal.id)} title="删除目标">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {isExpanded && goal.childGoals.map((child) => renderGoal(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">学习目标</h2>
          <p className="text-muted-foreground text-sm">
            关联笔记后，进度自动根据闪卡掌握率计算。刷新可获取最新进度。
          </p>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建目标
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建学习目标</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">目标名称</label>
                <Input placeholder="例如：掌握 Rust 所有权系统" value={title} onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createGoal()} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">描述 (可选)</label>
                <Textarea placeholder="更详细地描述你的目标..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">关联课程 (可多选)</label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {courses.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">暂无课程</p>
                  ) : (
                    courses.map((c) => {
                      const checked = courseIds.includes(c.id)
                      return (
                        <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (v) setCourseIds([...courseIds, c.id])
                              else setCourseIds(courseIds.filter(id => id !== c.id))
                            }}
                          />
                          {c.title}
                        </label>
                      )
                    })
                  )}
                </div>
                {courseIds.length > 0 && <p className="text-xs text-muted-foreground">已选 {courseIds.length} 门课程</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">父目标 (可选)</label>
                <Select value={parentGoalId || ""} onValueChange={(v) => setParentGoalId(v || null)}>
                  <SelectTrigger><SelectValue placeholder="顶级目标" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">顶级目标</SelectItem>
                    {goals.map((g) => (<SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createGoal} className="w-full" disabled={!title.trim()}>创建目标</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">还没有学习目标</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md text-center">
              创建一个学习目标，然后关联笔记。复习闪卡时，目标进度会自动更新。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => renderGoal(goal, 0))}
        </div>
      )}

      {/* Edit Goal Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑目标</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">目标名称</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">关联课程 (可多选)</label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {courses.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">暂无课程</p>
                ) : (
                  courses.map((c) => {
                    const checked = editCourseIds.includes(c.id)
                    return (
                      <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (v) setEditCourseIds([...editCourseIds, c.id])
                            else setEditCourseIds(editCourseIds.filter(id => id !== c.id))
                          }}
                        />
                        {c.title}
                      </label>
                    )
                  })
                )}
              </div>
            </div>
            <Button onClick={saveEdit} className="w-full" disabled={!editTitle.trim() || editing}>
              {editing ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
