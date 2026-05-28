"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Clock, Pencil, Loader2, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface NotePreview {
  id: string
  title: string
  excerpt: string | null
  updatedAt: string
  wordCount: number
}

interface Props {
  knowledgePointId: string
  courseId: string
}

export function KpNotes({ knowledgePointId }: Props) {
  const [notes, setNotes] = useState<NotePreview[]>([])
  const [loading, setLoading] = useState(true)
  // 新建笔记
  const [dialogOpen, setDialogOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [saving, setSaving] = useState(false)
  // 原地编辑笔记
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?knowledgePointId=${encodeURIComponent(knowledgePointId)}`)
      if (!res.ok) return
      setNotes(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [knowledgePointId])

  useEffect(() => { loadNotes() }, [loadNotes])

  async function createNote() {
    if (!noteTitle.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle.trim(),
          content: noteContent,
          knowledgePointId,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("笔记已创建")
      setDialogOpen(false)
      setNoteTitle("")
      setNoteContent("")
      loadNotes()
    } catch {
      toast.error("创建失败")
    }
    setSaving(false)
  }

  async function openEdit(noteId: string) {
    setEditOpen(true)
    setEditId(noteId)
    setEditLoading(true)
    setEditTitle("")
    setEditContent("")
    try {
      const res = await fetch(`/api/notes/${noteId}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setEditTitle(data.title || "")
      setEditContent(data.content || "")
    } catch {
      toast.error("加载笔记失败")
      setEditOpen(false)
    }
    setEditLoading(false)
  }

  async function saveEdit() {
    if (!editTitle.trim() || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/notes/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("笔记已保存")
      setEditOpen(false)
      loadNotes()
    } catch {
      toast.error("保存失败")
    }
    setEditSaving(false)
  }

  async function deleteNote() {
    if (!confirm("确定删除这条笔记？")) return
    try {
      const res = await fetch(`/api/notes/${editId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("笔记已删除")
      setEditOpen(false)
      loadNotes()
    } catch {
      toast.error("删除失败")
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">笔记 ({notes.length})</span>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3 w-3" />
          新建笔记
        </Button>
      </div>

      <div className="max-h-[260px] overflow-y-auto">
        {loading ? (
          <div className="py-4 text-sm text-muted-foreground">加载中...</div>
        ) : notes.length === 0 ? (
          <div className="py-6 text-center">
            <FileText className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
            <p className="text-xs text-muted-foreground">暂无笔记，点击「新建笔记」记录学习心得</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <button
                key={n.id}
                className="w-full text-left"
                onClick={() => openEdit(n.id)}
              >
                <Card className="p-3 cursor-pointer hover:border-primary/50 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{n.title}</span>
                        <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                      </div>
                      {n.excerpt && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.excerpt}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground/60">{formatDate(n.updatedAt)}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{n.wordCount} 字</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 新建笔记 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建笔记</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="笔记标题"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <Textarea
              placeholder="Markdown 内容..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[160px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={createNote} disabled={!noteTitle.trim() || saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 原地编辑笔记 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              编辑笔记
              <Link
                href={`/notes/${editId}`}
                target="_blank"
                className="text-muted-foreground hover:text-foreground ml-auto"
                title="在新页面打开"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </DialogTitle>
          </DialogHeader>
          {editLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              <Input
                placeholder="笔记标题"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <Textarea
                placeholder="Markdown 内容..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" size="sm" onClick={deleteNote} className="text-red-500 hover:text-red-600 gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
              <Button onClick={saveEdit} disabled={!editTitle.trim() || editSaving || editLoading}>
                {editSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
