"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Brain, Trash2, Clock, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Flashcard {
  id: string
  front: string
  back: string
  sourceType: string
  sm2Interval: number
  sm2Repetitions: number
  sm2Efactor: number
  sm2NextReview: string
  isSuspended: boolean
  page?: { id: string; title: string } | null
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("active")
  const [editOpen, setEditOpen] = useState(false)
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCards() }, [])

  async function fetchCards() {
    setLoading(true)
    try {
      const res = await fetch("/api/flashcards")
      if (res.ok) setCards(await res.json())
    } catch { toast.error("加载闪卡失败") }
    finally { setLoading(false) }
  }

  async function createCard() {
    if (!front.trim() || !back.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: front.trim(), back: back.trim() }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("闪卡已创建")
      setEditOpen(false)
      setFront("")
      setBack("")
      fetchCards()
    } catch { toast.error("创建失败") }
    finally { setSaving(false) }
  }

  async function deleteCard(id: string) {
    try {
      const res = await fetch(`/api/flashcards/${id}`, { method: "DELETE" })
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.id !== id))
        toast.success("已删除")
      }
    } catch { toast.error("删除失败") }
  }

  async function toggleSuspend(card: Flashcard) {
    try {
      const res = await fetch(`/api/flashcards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspended: !card.isSuspended }),
      })
      if (res.ok) {
        setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, isSuspended: !c.isSuspended } : c))
        toast.success(card.isSuspended ? "已恢复" : "已暂停")
      }
    } catch { toast.error("操作失败") }
  }

  const filtered = cards.filter((c) => {
    if (filter === "active") return !c.isSuspended
    if (filter === "suspended") return c.isSuspended
    if (filter === "due") return new Date(c.sm2NextReview) <= new Date()
    return true
  })

  function formatInterval(card: Flashcard): string {
    const days = card.sm2Interval
    if (days < 1) return "<1天"
    if (days === 1) return "1天"
    if (days < 7) return `${Math.round(days)}天`
    if (days < 30) return `${Math.round(days / 7)}周`
    return `${Math.round(days / 30)}月`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">闪卡管理</h2>
          <p className="text-muted-foreground">浏览、创建和管理你的闪卡</p>
        </div>
        <Button onClick={() => { setEditOpen(true); setFront(""); setBack("") }}>
          <Plus className="mr-2 h-4 w-4" />
          新建闪卡
        </Button>
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: `全部 (${cards.length})` },
          { key: "active", label: `活跃 (${cards.filter((c) => !c.isSuspended).length})` },
          { key: "due", label: `待复习 (${cards.filter((c) => !c.isSuspended && new Date(c.sm2NextReview) <= new Date()).length})` },
          { key: "suspended", label: `已暂停 (${cards.filter((c) => c.isSuspended).length})` },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Brain className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">没有闪卡</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setEditOpen(true)}>
              创建第一张闪卡
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => (
            <Card key={card.id} className={`group ${card.isSuspended ? "opacity-50" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    {card.sourceType === "ai_generated" ? "AI 生成" : "手动创建"}
                  </Badge>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSuspend(card)} title={card.isSuspended ? "恢复" : "暂停"}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteCard(card.id)} title="删除">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm line-clamp-3">{card.front}</p>
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">{card.back}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatInterval(card)}
                  </span>
                  <span>复习 {card.sm2Repetitions}次</span>
                  <span>易度 {card.sm2Efactor.toFixed(1)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建闪卡</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">问题 (正面)</label>
              <Textarea
                placeholder="输入问题..."
                value={front}
                onChange={(e) => setFront(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">答案 (背面)</label>
              <Textarea
                placeholder="输入答案..."
                value={back}
                onChange={(e) => setBack(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={createCard} disabled={saving || !front.trim() || !back.trim()} className="w-full">
              {saving ? "创建中..." : "创建闪卡"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
