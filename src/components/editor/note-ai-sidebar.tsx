"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, Brain, FileText } from "lucide-react"
import { toast } from "sonner"

interface Props {
  noteId: string | null
  content: string
  title: string
  onLinksClick: () => void
}

export function NoteAiSidebar({ noteId, content, title, onLinksClick }: Props) {
  const [aiLoading, setAiLoading] = useState<string | null>(null)

  async function generateFlashcards() {
    if (!noteId) return
    setAiLoading("flashcards")
    try {
      const res = await fetch("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`成功生成 ${data.count} 张闪卡`)
      } else {
        toast.error(data.error || "生成失败，请检查 AI API 配置")
      }
    } catch {
      toast.error("AI 服务暂不可用")
    } finally {
      setAiLoading(null)
    }
  }

  async function summarizeNote() {
    if (!noteId) return
    setAiLoading("summarize")
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, noteContent: content, noteTitle: title }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("摘要已生成")
      } else {
        toast.error(data.error || "摘要生成失败")
      }
    } catch {
      toast.error("AI 服务暂不可用")
    } finally {
      setAiLoading(null)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-sm">AI 操作</h3>
        <Button
          variant="outline" size="sm" className="w-full justify-start"
          onClick={generateFlashcards}
          disabled={!noteId || aiLoading === "flashcards"}
        >
          {aiLoading === "flashcards" ? (
            <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Sparkles className="mr-2 h-3 w-3" />
          )}
          生成闪卡
        </Button>
        <Button
          variant="outline" size="sm" className="w-full justify-start"
          onClick={summarizeNote}
          disabled={!noteId || aiLoading === "summarize"}
        >
          {aiLoading === "summarize" ? (
            <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Brain className="mr-2 h-3 w-3" />
          )}
          总结笔记
        </Button>
        <Button
          variant="outline" size="sm" className="w-full justify-start"
          onClick={onLinksClick}
          disabled={!noteId}
        >
          <FileText className="mr-2 h-3 w-3" />
          查看链接
        </Button>
      </CardContent>
    </Card>
  )
}
