"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Clock, Trash2, ChevronDown, Sparkles, Layers, Brain, ExternalLink, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { formatDate } from "@/lib/format-date"

// ============================================================
/// Unified Learning Notes — sidebar + card variants for knowledge-point notes
// Supports: quick capture, progressive summarization, flashcard bridge
// ============================================================

interface NotePreview {
  id: string; title: string; excerpt: string | null
  updatedAt: string; wordCount: number
}

interface NoteLayer {
  level: number; content: string; createdAt: string; source: "user" | "ai"
}

interface FullNote {
  id: string; title: string; content: string
  noteLayers: string; currentLayer: number
}

interface Props {
  knowledgePointId: string
  variant?: "sidebar" | "card"
  onNoteCountChange?: (count: number) => void
}

export function LearningNotes({ knowledgePointId, variant = "sidebar", onNoteCountChange }: Props) {
  const [notes, setNotes] = useState<NotePreview[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [currentLayer, setCurrentLayer] = useState(1)
  const [layers, setLayers] = useState<NoteLayer[]>([])
  const [condensing, setCondensing] = useState(false)
  const [generatingCards, setGeneratingCards] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?knowledgePointId=${encodeURIComponent(knowledgePointId)}`)
      if (!res.ok) return
      const list: NotePreview[] = await res.json()
      setNotes(list)
      onNoteCountChange?.(list.length)
    } catch { /* ignore */ }
    setLoading(false)
  }, [knowledgePointId, onNoteCountChange])

  useEffect(() => { setActiveId(null); setLoading(true); loadNotes() }, [knowledgePointId, loadNotes])

  // Load full note when activeId changes
  useEffect(() => {
    if (!activeId || activeId === "__new__") return
    setEditLoading(true)
    fetch(`/api/notes/${activeId}`)
      .then((r) => r.json())
      .then((data: FullNote) => {
        setEditTitle(data.title || ""); setEditContent(data.content || ""); setIsNew(false)
        try { const p = JSON.parse(data.noteLayers || "[]") as NoteLayer[]; setLayers(p); setCurrentLayer(data.currentLayer || 1) }
        catch { setLayers([]); setCurrentLayer(1) }
      })
      .catch(() => toast.error("加载笔记失败"))
      .finally(() => setEditLoading(false))
  }, [activeId])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [])

  async function saveNote() {
    if (!editTitle.trim() || saving) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch("/api/notes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle.trim(), content: editContent, knowledgePointId }),
        })
        if (!res.ok) throw new Error("Failed")
        toast.success("笔记已创建")
      } else if (activeId) {
        const payload: Record<string, unknown> = { title: editTitle.trim(), content: editContent }
        if (layers.length > 0) { payload.noteLayers = JSON.stringify(layers); payload.currentLayer = currentLayer }
        const res = await fetch(`/api/notes/${activeId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed")
        toast.success("已保存")
      }
      setIsNew(false); setActiveId(null); loadNotes()
    } catch { toast.error("保存失败") }
    setSaving(false)
  }

  async function deleteNote() {
    if (!activeId || !confirm("确定删除这条笔记？")) return
    try { await fetch(`/api/notes/${activeId}`, { method: "DELETE" }); toast.success("笔记已删除"); setActiveId(null); setEditTitle(""); setEditContent(""); setLayers([]); setCurrentLayer(1); loadNotes() }
    catch { toast.error("删除失败") }
  }

  function startNew() { setActiveId("__new__"); setEditTitle(""); setEditContent(""); setLayers([]); setCurrentLayer(1); setIsNew(true); setDropdownOpen(false) }

  async function condenseToNextLayer() {
    if (condensing || !editContent.trim()) return
    setCondensing(true)
    try {
      const res = await fetch("/api/ai/progressive-condense", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, currentLayer, noteTitle: editTitle }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const nl: NoteLayer = { level: currentLayer + 1, content: data.condensed, createdAt: new Date().toISOString(), source: "ai" }
      const updated = [...layers, nl]; setLayers(updated); setCurrentLayer(currentLayer + 1); setEditContent(data.condensed)
      toast.success(`已浓缩到第 ${currentLayer + 1} 层`)
    } catch { toast.error("浓缩失败") }
    setCondensing(false)
  }

  async function generateFlashcardsFromNote() {
    if (generatingCards || !activeId || activeId === "__new__") return
    setGeneratingCards(true)
    try {
      const res = await fetch("/api/ai/generate-flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: activeId }) })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      toast.success(`已生成 ${data.count || 0} 张闪卡，加入复习队列`)
    } catch { toast.error("闪卡生成失败") }
    setGeneratingCards(false)
  }


  const activeNote = notes.find((n) => n.id === activeId)
  const LAYER_LABELS = ["", "原始笔记", "加粗关键", "高亮核心", "一句话总结", "闪卡就绪"]

  // ============== SIDEBAR VARIANT ==============
  if (variant === "sidebar") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
          <div className="flex items-center gap-2"><span className="text-sm font-medium">笔记</span>{notes.length > 0 && <Badge variant="secondary" className="text-[10px]">{notes.length}</Badge>}</div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={startNew}><Plus className="h-3 w-3" />新建</Button>
        </div>
        {notes.length > 1 && (
          <div className="relative px-3 pt-2 shrink-0" ref={dropdownRef}>
            <button className="flex items-center justify-between w-full rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <span className="truncate">{isNew ? "新建笔记..." : activeNote?.title || "选择笔记"}</span><ChevronDown className="h-3 w-3 ml-1 shrink-0" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-3 right-3 z-10 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                {notes.map((n) => (<button key={n.id} className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted ${n.id === activeId ? "bg-muted font-medium" : ""}`} onClick={() => { setActiveId(n.id); setDropdownOpen(false) }}><span className="truncate block">{n.title}</span><span className="text-[10px] text-muted-foreground">{formatDate(n.updatedAt)}</span></button>))}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {loading ? <p className="text-xs text-muted-foreground py-8 text-center">加载中...</p>
          : !activeId ? (
            <div className="py-12 text-center"><FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-xs text-muted-foreground">暂无笔记</p><Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={startNew}><Plus className="h-3 w-3 mr-1" />新建笔记</Button></div>
          ) : editLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : (<>
            <Input placeholder="笔记标题" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm border-0 border-b rounded-none px-0 focus-visible:ring-0 font-medium" />
            <Textarea placeholder="写点什么..." value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[180px] text-sm resize-none" />
            {layers.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px]"><Layers className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">第 {currentLayer} 层 · {LAYER_LABELS[currentLayer]}</span><div className="flex-1" />
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-purple-500 hover:text-purple-600" onClick={condenseToNextLayer} disabled={condensing || currentLayer >= 5}>{condensing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}{currentLayer < 5 ? "AI 浓缩" : "已到顶层"}</Button>
              </div>
            )}
            {!isNew && editContent.length > 100 && (
              <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400" onClick={generateFlashcardsFromNote} disabled={generatingCards}>{generatingCards ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}{generatingCards ? "生成中..." : "从笔记生成闪卡 · 加入复习"}</Button>
            )}
            {activeNote && <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{formatDate(activeNote.updatedAt)}<Badge variant="secondary" className="text-[10px] px-1 py-0">{activeNote.wordCount} 字</Badge><div className="flex-1" /><Link href={`/notes/${activeNote.id}`} target="_blank" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></Link></div>}
            <div className="flex items-center justify-between pt-2 border-t">{!isNew && <Button variant="ghost" size="sm" onClick={deleteNote} className="text-red-500 hover:text-red-600 h-7 text-xs gap-1"><Trash2 className="h-3 w-3" />删除</Button>}{isNew && <div />}<Button size="sm" onClick={saveNote} disabled={!editTitle.trim() || saving} className="h-7 text-xs">{saving ? "保存中..." : "保存"}</Button></div>
          </>)}
        </div>
      </div>
    )
  }

  // ============== CARD VARIANT (course detail) ==============
  return (
    <div>
      <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">笔记 ({notes.length})</span><Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={startNew}><Plus className="h-3 w-3" />新建笔记</Button></div>
      <div className="max-h-[260px] overflow-y-auto">
        {loading ? <div className="py-4 text-sm text-muted-foreground">加载中...</div>
        : notes.length === 0 ? <div className="py-6 text-center"><FileText className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" /><p className="text-xs text-muted-foreground">暂无笔记</p></div>
        : <div className="space-y-2">{notes.map((n) => (<button key={n.id} className="w-full text-left" onClick={() => setActiveId(n.id)}><div className="rounded-lg border p-3 cursor-pointer hover:border-primary/50 transition-colors"><div className="flex-1 min-w-0"><span className="text-sm font-medium truncate block">{n.title}</span>{n.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.excerpt}</p>}<div className="flex items-center gap-2 mt-1.5"><Clock className="h-3 w-3 text-muted-foreground/50" /><span className="text-[10px] text-muted-foreground/60">{formatDate(n.updatedAt)}</span><Badge variant="secondary" className="text-[10px] px-1 py-0">{n.wordCount} 字</Badge></div></div></div></button>))}</div>}
      </div>
      {/* Edit modal for card variant */}
      {activeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActiveId(null)}>
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b"><span className="font-medium text-sm">{isNew ? "新建笔记" : "编辑笔记"}</span><button className="text-muted-foreground hover:text-foreground" onClick={() => setActiveId(null)}>✕</button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {editLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (<>
                <Input placeholder="笔记标题" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <Textarea placeholder="Markdown 内容..." value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[200px]" />
                {layers.length > 0 && (<div className="flex items-center gap-1.5 text-[10px]"><Layers className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">第 {currentLayer} 层 · {LAYER_LABELS[currentLayer]}</span><div className="flex-1" /><Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-purple-500" onClick={condenseToNextLayer} disabled={condensing || currentLayer >= 5}>{condensing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}AI 浓缩</Button></div>)}
                {!isNew && editContent.length > 100 && (<Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5 border-purple-200 text-purple-600" onClick={generateFlashcardsFromNote} disabled={generatingCards}>{generatingCards ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}生成闪卡 · 加入复习</Button>)}
              </>)}
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t">{!isNew && <Button variant="ghost" size="sm" onClick={deleteNote} className="text-red-500 h-7 text-xs gap-1"><Trash2 className="h-3 w-3" />删除</Button>}{isNew && <div />}<div className="flex gap-2"><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActiveId(null)}>取消</Button><Button size="sm" className="h-7 text-xs" onClick={saveNote} disabled={!editTitle.trim() || saving}>{saving ? "保存中..." : "保存"}</Button></div></div>
          </div>
        </div>
      )}
    </div>
  )
}
