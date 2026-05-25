"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Clock, ExternalLink } from "lucide-react"
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [saving, setSaving] = useState(false)

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
              <Link key={n.id} href={`/notes/${n.id}`}>
                <Card className="p-3 cursor-pointer hover:border-primary/50 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{n.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
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
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Note Dialog */}
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
    </div>
  )
}
