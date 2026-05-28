"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Plus, MessageSquare, Sparkles, Brain, FileText, Volume2, Mic, MicOff } from "lucide-react"
import { renderMarkdown } from "@/lib/markdown"
import { toast } from "sonner"

interface Conversation {
  id: string
  title: string | null
  createdAt: string
  messageCount: number
}

interface Message {
  role: string
  content: string
}

interface ChatPanelProps {
  conversations: Conversation[]
  courseId?: string
  knowledgePointId?: string
  kpTitle?: string
}

export function ChatPanel({ conversations, courseId, knowledgePointId, kpTitle }: ChatPanelProps) {
  const isCurriculumMode = !!(courseId && knowledgePointId)

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: isCurriculumMode
      ? `你好！我是你的 AI 老师。\n\n我们正在学习：**${kpTitle || "当前知识点"}**\n\n在开始讲解之前，先问你一个问题 👇\n\n👉 关于这个内容，你目前了解多少？是完全零基础，还是已经有一些接触了？`
      : "你好！我是你的 AI 学习助手。我会记住你的学习档案和所有指令锚点。有什么想学的吗？" },
  ])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const [convId, setConvId] = useState<string | null>(null)
  const [convList, setConvList] = useState(conversations)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  // Speech-to-text
  function toggleListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error("当前浏览器不支持语音识别，请使用 Chrome 或 Edge")
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = "zh-CN"
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("")
      setInput(transcript)
    }
    recognition.onerror = () => { setListening(false) }
    recognition.onend = () => { setListening(false) }
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  // Reset conversation when switching knowledge points in curriculum mode
  useEffect(() => {
    if (!isCurriculumMode) return
    setConvId(null)
    setMessages([
      { role: "assistant", content: `你好！我是你的 AI 老师。\n\n我们正在学习：**${kpTitle || "当前知识点"}**\n\n在开始讲解之前，先问你一个问题 👇\n\n👉 关于这个内容，你目前了解多少？是完全零基础，还是已经有一些接触了？` },
    ])
    async function loadKpConversation() {
      try {
        const params = new URLSearchParams({ knowledgePointId: knowledgePointId! })
        if (courseId) params.set("courseId", courseId)
        const res = await fetch(`/api/ai/chat?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.conversation) {
          setConvId(data.conversation.id)
        }
        if (data.messages?.length > 0) {
          setMessages(data.messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })))
        }
      } catch { /* ignore */ }
    }
    loadKpConversation()
  }, [knowledgePointId, courseId])

  // Load messages when switching conversations
  useEffect(() => {
    if (!convId) return
    async function loadMessages() {
      try {
        const res = await fetch(`/api/ai/chat?conversationId=${convId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.messages?.length > 0) {
          setMessages(data.messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })))
        }
      } catch { /* ignore */ }
    }
    loadMessages()
  }, [convId])

  async function sendMessage() {
    if (!input.trim() || streaming) return

    const userMsg = input
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setStreaming(true)

    let assistantMsg = ""
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          conversationId: convId,
          courseId,
          knowledgePointId,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No reader")

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))
        for (const line of lines) {
          const data = JSON.parse(line.slice(6))
          if (data.error) {
            toast.error("AI 服务暂不可用，请检查 API Key")
            break
          }
          if (data.content) {
            assistantMsg += data.content
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: "assistant", content: assistantMsg }
              return updated
            })
          }
          if (data.done && data.conversationId) {
            setConvId(data.conversationId)
            setConvList((prev) => {
              if (prev.some((c) => c.id === data.conversationId)) return prev
              return [{ id: data.conversationId, title: userMsg.slice(0, 50), createdAt: new Date().toISOString(), messageCount: 2 }, ...prev]
            })
          }
        }
      }
    } catch {
      toast.error("发送失败")
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: "assistant", content: "抱歉，消息发送失败。请检查 AI API 配置。" }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function speak(text: string, index: number) {
    const synth = window.speechSynthesis
    if (synth.speaking) {
      synth.cancel()
      if (speakingIndex === index) { setSpeakingIndex(null); return }
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "zh-CN"
    u.rate = 1.1
    u.onend = () => setSpeakingIndex(null)
    setSpeakingIndex(index)
    synth.speak(u)
  }

  return (
    <div className={`flex gap-4 ${isCurriculumMode ? "h-full" : "h-[calc(100vh-8rem)]"}`}>
      {/* Conversation List — hidden in curriculum mode */}
      {!isCurriculumMode && (
      <div className="hidden w-56 shrink-0 lg:block">
        <Card className="h-full p-2">
          <div className="flex items-center justify-between mb-2 px-2 pt-2">
            <h3 className="text-sm font-semibold">对话</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
              setMessages([{ role: "assistant", content: "你好！我是你的 AI 学习助手。我会记住你的学习档案和所有指令锚点。有什么想学的吗？" }])
              setConvId(null)
            }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(100%-3rem)]">
            <div className="space-y-1 px-1">
              {convList.map((c) => (
                <button
                  key={c.id}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${convId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  onClick={() => setConvId(c.id)}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.title || "新对话"}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
      )}

      {/* Chat Area */}
      <div className="flex flex-1 flex-col rounded-lg border bg-card">
        {/* Context Indicator */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Badge variant="outline" className="text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            学习档案已加载
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Brain className="h-3 w-3" />
            指令锚点已注入
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
            <FileText className="h-3 w-3" />
            AI 记忆已激活
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          <div className={`space-y-4 ${isCurriculumMode ? "" : "max-w-3xl mx-auto"}`}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`${isCurriculumMode ? "max-w-[92%]" : "max-w-[80%]"} rounded-lg px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    msg.content ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} /> : (streaming && i === messages.length - 1 ? <span className="text-muted-foreground">思考中...</span> : null)
                  )}
                  {msg.role === "assistant" && msg.content && !msg.content.startsWith("你好！我是") && (
                    <button
                      className="mt-1 text-muted-foreground/50 hover:text-primary transition-colors"
                      onClick={() => speak(msg.content, i)}
                      title={speakingIndex === i ? "朗读中..." : "朗读"}
                    >
                      <Volume2 className={`h-3.5 w-3.5 ${speakingIndex === i ? "text-primary animate-pulse" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="输入你的问题... (Enter 发送，Shift+Enter 换行)"
              className="min-h-[44px] resize-none"
              rows={1}
              disabled={streaming}
            />
            <Button
              variant={listening ? "destructive" : "ghost"}
              size="icon"
              onClick={toggleListening}
              disabled={streaming}
              title={listening ? "停止录音" : "语音输入"}
            >
              {listening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button onClick={sendMessage} disabled={!input.trim() || streaming} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
