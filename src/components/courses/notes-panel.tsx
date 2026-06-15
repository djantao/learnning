"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Clock, Trash2, ChevronDown } from "lucide-react"
import { toast } from "sonner"

interface NotePreview {
  id: string
  title: string
  excerpt: string | null
  updatedAt: string
  wordCount: number
}

export function NotesPanel({ knowledgePointId }: { knowledgePointId: string }) {
  const [notes, setNotes] = useState<NotePreview[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?knowledgePointId=${encodeURIComponent(knowledgePointId)}`)
      if (!res.ok) return
      const list: NotePreview[] = await res.json()
      setNotes(list)
      if (list.length > 0 && !activeId) {
        setActiveId(list[0].id)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [knowledgePointId])

  useEffect(() => { setActiveId(null); setLoading(true); loadNotes() }, [knowledgePointId])

  // Load note content when activeId changes
  useEffect(() => {
    if (!activeId || activeId === "__new__") return
    setEditLoading(true)
    fetch(`/api/notes/${activeId}`)
      .then((r) => r.json())
      .then((data) => {
        setEditTitle(data.title || "")
        setEditContent(data.content || "")
        setIsNew(false)
      })
      .catch(() => toast.error("加载笔记失败"))
      .finally(() => setEditLoading(false))
  }, [activeId])

  async function saveNote() {
    if (!editTitle.trim() || saving) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle.trim(), content: editContent, knowledgePointId }),
        })
        if (!res.ok) throw new Error("Failed")
        toast.success("笔记已创建")
      } else if (activeId) {
        const res = await fetch(`/api/notes/${activeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle.trim(), content: editContent }),
        })
        if (!res.ok) throw new Error("Failed")
        toast.success("已保存")
      }
      setIsNew(false)
      setActiveId(null) // trigger reload
      loadNotes()
    } catch {
      toast.error("保存失败")
    }
    setSaving(false)
  }

  async function deleteNote() {
    if (!activeId || !confirm("确定删除这条笔记？")) return
    try {
      await fetch(`/api/notes/${activeId}`, { method: "DELETE" })
      toast.success("笔记已删除")
      setActiveId(null)
      setEditTitle("")
      setEditContent("")
      loadNotes()
    } catch {
      toast.error("删除失败")
    }
  }

  function startNew() {
    setActiveId("__new__")
    setEditTitle("")
    setEditContent("")
    setIsNew(true)
    setDropdownOpen(false)
  }

  function switchNote(id: string) {
    setActiveId(id)
    setDropdownOpen(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  const activeNote = notes.find((n) => n.id === activeId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">笔记</span>
          {notes.length > 0 && <Badge variant="secondary" className="text-[10px]">{notes.length}</Badge>}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={startNew}>
          <Plus className="h-3 w-3" />新建
        </Button>
      </div>

      {/* Note selector dropdown */}
      {notes.length > 1 && (
        <div className="relative px-3 pt-2 shrink-0" ref={dropdownRef}>
          <button
            className="flex items-center justify-between w-full rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span className="truncate">{isNew ? "新建笔记..." : activeNote?.title || "选择笔记"}</span>
            <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-3 right-3 z-10 mt-1 rounded-md border bg-popover shadow-md">
              {notes.map((n) => (
                <button
                  key={n.id}
                  className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted transition-colors ${n.id === activeId ? "bg-muted font-medium" : ""}`}
                  onClick={() => switchNote(n.id)}
                >
                  <span className="truncate block">{n.title}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(n.updatedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">加载中...</p>
        ) : !activeId ? (
          <div className="py-12 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">暂无笔记</p>
            <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={startNew}>
              <Plus className="h-3 w-3 mr-1" />新建笔记
            </Button>
          </div>
        ) : editLoading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">加载中...</p>
        ) : (
          <>
            <Input
              placeholder="笔记标题"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm border-0 border-b rounded-none px-0 focus-visible:ring-0 font-medium"
            />
            <Textarea
              placeholder="Markdown 内容..."
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px] text-sm resize-none"
            />
            {activeNote && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(activeNote.updatedAt)}
                <Badge variant="secondary" className="text-[10px] px-1 py-0">{activeNote.wordCount} 字</Badge>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              {!isNew && (
                <Button variant="ghost" size="sm" onClick={deleteNote} className="text-red-500 hover:text-red-600 h-7 text-xs gap-1">
                  <Trash2 className="h-3 w-3" />删除
                </Button>
              )}
              {isNew && <div />}
              <Button size="sm" onClick={saveNote} disabled={!editTitle.trim() || saving} className="h-7 text-xs">
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
