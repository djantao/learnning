"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"

type Message = {
  role: "coach" | "you"
  text: string
  sub?: string
  score?: number
}

interface Stats {
  total: number
  traditional: { count: number; pct: number }
  coach: { count: number; pct: number; totalRounds: number; totalMinutes: number }
  today: { coachRounds: number; coachMinutes: number; traditionalMinutes: number }
}

function CoachPageInner() {
  const searchParams = useSearchParams()
  const targetKpId = searchParams.get("kpId")

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionState, setSessionState] = useState<{
    sessionId: string
    courseTitle: string
    kpTitle: string
    difficulty: string
    courseId?: string
    kpId?: string
    rounds: { q: string; a?: string; feedback?: string }[]
  } | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState("")
  const [currentReference, setCurrentReference] = useState("")
  const [roundCount, setRoundCount] = useState(0)
  const [sessionStart] = useState(Date.now())
  const [stats, setStats] = useState<Stats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 初始化
  useEffect(() => {
    const url = targetKpId ? `/api/coach?kpId=${targetKpId}` : "/api/coach"
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.ready !== false) {
          setSessionState(data)
          if (targetKpId) {
            setMessages([{
              role: "coach",
              text: `👋 你选择了教练模式学习「${data.kpTitle}」(${data.difficulty}层级)。点「教练发问」开始，我会用问题帮你深入理解。`
            }])
          } else {
            setMessages([{
              role: "coach",
              text: `👋 我是你的学习教练。你目前在学「${data.courseTitle}」的「${data.kpTitle}」(${data.difficulty}层级)。`
            }])
          }
        } else {
          setMessages([{ role: "coach", text: "👋 你还没有创建学习计划。请先去课程页面创建一门课程。" }])
        }
      })
    loadStats()
  }, [targetKpId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadStats = async () => {
    try {
      const res = await fetch("/api/coach/session")
      const data = await res.json()
      if (!data.error) setStats(data)
    } catch {}
  }

  // 记录学习会话
  const recordSession = useCallback(async (mode: string, rounds: number) => {
    const duration = Math.round((Date.now() - sessionStart) / 1000)
    try {
      await fetch("/api/coach/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          courseId: sessionState?.courseId,
          kpId: sessionState?.kpId,
          rounds,
          duration,
        }),
      })
      loadStats()
    } catch {}
  }, [sessionStart, sessionState])

  // 离开页面时记录
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roundCount > 0) {
        navigator.sendBeacon("/api/coach/session", JSON.stringify({
          mode: "coach",
          courseId: sessionState?.courseId,
          kpId: sessionState?.kpId,
          rounds: roundCount,
          duration: Math.round((Date.now() - sessionStart) / 1000),
        }))
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [roundCount, sessionStart, sessionState])

  const askCoach = async () => {
    setLoading(true)
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "question" }),
    })
    const data = await res.json()
    if (data.question) {
      setCurrentQuestion(data.question)
      setCurrentReference(data.referenceAnswer || "")
      setMessages((prev) => [...prev, { role: "coach", text: data.question }])
    } else {
      setMessages((prev) => [...prev, { role: "coach", text: data.error || "出错了" }])
    }
    setLoading(false)
  }

  const submitAnswer = async () => {
    if (!input.trim() || !currentQuestion) return
    const myAnswer = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "you", text: myAnswer }])
    setLoading(true)

    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "answer",
        question: currentQuestion,
        answer: myAnswer,
        referenceAnswer: currentReference,
        difficulty: sessionState?.difficulty,
        kpTitle: sessionState?.kpTitle,
      }),
    })
    const data = await res.json()

    setMessages((prev) => [...prev, {
      role: "coach",
      text: data.feedback || "收到！",
      sub: data.followUp || "",
      score: data.score,
    }])

    if (sessionState) {
      setSessionState({
        ...sessionState,
        rounds: [...sessionState.rounds, { q: currentQuestion, a: myAnswer, feedback: data.feedback }],
      })
    }

    const newRoundCount = roundCount + 1
    setRoundCount(newRoundCount)

    // 每 3 轮记录一次
    if (newRoundCount % 3 === 0) {
      recordSession("coach", newRoundCount)
    }

    if (data.followUp) {
      setCurrentQuestion(data.followUp)
      setCurrentReference("")
    } else {
      setCurrentQuestion("")
      setCurrentReference("")
    }
    setLoading(false)
  }

  const resetSession = async () => {
    if (roundCount > 0) {
      await recordSession("coach", roundCount)
    }
    setRoundCount(0)
    await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    })
    setMessages([{ role: "coach", text: "🔄 开始了新的学习会话。" }])
    setCurrentQuestion("")
    setCurrentReference("")
  }

  const toggleStats = () => {
    setShowStats(!showStats)
    if (!showStats) loadStats()
  }

  return (
    <div className="max-w-lg mx-auto h-[calc(100vh-120px)] flex flex-col">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur border-b border-gray-100">
        {sessionState ? (
          <>
            <div className="text-xs text-gray-500">
              📚 {sessionState.courseTitle} · {sessionState.kpTitle}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                sessionState.difficulty === "入门" ? "bg-green-100 text-green-700" :
                sessionState.difficulty === "进阶" ? "bg-blue-100 text-blue-700" :
                "bg-purple-100 text-purple-700"
              }`}>
                {sessionState.difficulty}
              </span>
              <button onClick={toggleStats} className="text-xs text-gray-400 hover:text-gray-600">
                📊
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400">加载中...</div>
        )}
      </div>

      {/* 统计面板 */}
      {showStats && stats && (
        <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100">
          <h3 className="text-xs font-medium text-gray-600 mb-2">📊 学习方式统计</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded-lg p-2">
              <div className="text-gray-400">📖 传统学习</div>
              <div className="font-semibold text-gray-700">
                {stats.traditional.count || 0} 次 ({stats.traditional.pct}%)
              </div>
              <div className="text-gray-400">今天 {stats.today.traditionalMinutes} 分钟</div>
            </div>
            <div className="bg-white rounded-lg p-2">
              <div className="text-gray-400">🎯 教练问答</div>
              <div className="font-semibold text-gray-700">
                {stats.coach.count || 0} 次 ({stats.coach.pct}%)
              </div>
              <div className="text-gray-400">{stats.coach.totalRounds || 0} 轮 · 今天 {stats.today.coachRounds} 轮</div>
            </div>
          </div>
        </div>
      )}

      {/* 对话区 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "you" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${
              msg.role === "you"
                ? "bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2.5"
                : "bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md px-4 py-2.5"
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.sub && (
                <div className="mt-2 pt-2 border-t border-gray-200/60">
                  <p className="text-xs text-gray-500 leading-relaxed">{msg.sub}</p>
                </div>
              )}
              {msg.score !== undefined && (
                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <span key={j} className={`text-xs ${j < (msg.score || 0) ? "text-yellow-500" : "text-gray-300"}`}>
                      ★
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 底部操作区 */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur border-t border-gray-100 space-y-2">
        {currentQuestion ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              placeholder="写下你的回答..."
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              disabled={loading}
              autoFocus
            />
            <button
              onClick={submitAnswer}
              disabled={!input.trim() || loading}
              className="px-5 py-2.5 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition"
            >
              发送
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={askCoach}
              disabled={loading || !sessionState}
              className="flex-1 py-2.5 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition"
            >
              🎯 教练发问
            </button>
            <button
              onClick={resetSession}
              disabled={loading}
              className="px-4 py-2.5 text-gray-400 hover:text-gray-600 text-sm transition"
            >
              重置
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CoachPage() {
  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    }>
      <CoachPageInner />
    </Suspense>
  )
}
