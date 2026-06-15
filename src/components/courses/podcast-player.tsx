"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2, Play, Pause, SkipForward, Headphones, RotateCw } from "lucide-react"
import { toast } from "sonner"
import { synthesizePodcastClient } from "@/lib/tts-client"

interface Segment {
  speaker: string
  text: string
}

export function PodcastPlayer({ knowledgePointId }: { knowledgePointId: string }) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [synthesizing, setSynthesizing] = useState(false)
  const [synthProgress, setSynthProgress] = useState({ current: 0, total: 0 })
  const [playing, setPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  const [textOnly, setTextOnly] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 加载已有播客脚本
  useEffect(() => {
    async function loadExisting() {
      setLoading(true)
      try {
        const res = await fetch("/api/ai/generate-podcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knowledgePointId, mode: "load" }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data?.segments?.length > 0) {
          setSegments(data.segments)
          setTitle(data.title)
          setDuration(data.duration || 0)
          // 服务端如果有音频就用（缓存命中），否则客户端合成
          if (data.audioBase64) {
            const blob = base64ToBlob(data.audioBase64, "audio/mp3")
            setAudioUrl(URL.createObjectURL(blob))
          }
        }
      } catch { /* 静默 */ }
      setLoading(false)
    }
    loadExisting()
  }, [knowledgePointId])

  function base64ToBlob(base64: string, mime: string) {
    const bytes = atob(base64)
    const buf = new ArrayBuffer(bytes.length)
    const arr = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new Blob([buf], { type: mime })
  }

  // 当 audioUrl 变化时，创建 audio 元素
  useEffect(() => {
    if (!audioUrl) return
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.ontimeupdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
      if (duration > 0 && segments.length > 0) {
        const pct = audio.currentTime / duration
        setCurrentIdx(Math.min(Math.floor(pct * segments.length), segments.length - 1))
      }
    }
    audio.onended = () => { setPlaying(false); setCurrentIdx(-1); setProgress(0) }
    audio.onerror = () => { toast.error("音频播放失败"); setPlaying(false) }

    return () => { audio.pause(); audio.src = "" }
  }, [audioUrl, duration, segments.length])

  // 生成脚本
  async function generateScript() {
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePointId, mode: "generate" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "播客生成失败")
        return false
      }
      const data = await res.json()
      if (!data.segments?.length) { toast.error("播客内容为空"); return false }
      setSegments(data.segments)
      setTitle(data.title)
      setDuration(data.duration || 0)
      setAudioUrl(null) // 重置音频，等客户端合成
      return true
    } catch { toast.error("播客生成失败"); return false }
    finally { setGenerating(false) }
  }

  // 客户端合成音频（浏览器直连微软 TTS）
  async function synthesize() {
    if (segments.length === 0) return false
    setSynthesizing(true)
    setSynthProgress({ current: 0, total: segments.length })
    try {
      const url = await synthesizePodcastClient(segments, (idx, total) => {
        setSynthProgress({ current: idx + 1, total })
      })
      setAudioUrl(url)
      toast.success("音频合成完成！")
      return true
    } catch (err: any) {
      toast.error("TTS合成失败，可阅读文本播客")
      setTextOnly(true)
      return false
    }
    finally { setSynthesizing(false); setSynthProgress({ current: 0, total: 0 }) }
  }

  // 生成 + 合成
  async function generateAndSynthesize() {
    const ok = await generateScript()
    if (!ok) return
    await synthesize()
  }

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) { toast.error("请先生成播客"); return }
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play().catch(() => toast.error("播放失败")); setPlaying(true) }
  }, [playing])

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
    setPlaying(false); setCurrentIdx(-1); setProgress(0)
  }, [])

  const seekTo = useCallback((pct: number) => {
    const audio = audioRef.current
    if (audio?.duration) { audio.currentTime = (pct / 100) * audio.duration; setProgress(pct) }
  }, [])

  const hasScript = segments.length > 0
  const hasAudio = !!audioUrl
  const canPlay = hasScript && hasAudio && !synthesizing

  return (
    <div className="flex items-center gap-2">
      {/* 初始状态：加载或显示播客按钮 */}
      {loading ? (
        <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />加载...
        </Button>
      ) : synthesizing ? (
        <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          合成中 {synthProgress.current}/{synthProgress.total}
        </Button>
      ) : generating ? (
        <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />生成脚本...
        </Button>
      ) : !hasScript ? (
        <Button variant="ghost" size="sm" onClick={generateAndSynthesize} className="gap-1.5 text-xs">
          <Headphones className="h-3.5 w-3.5" />播客
        </Button>
      ) : !hasAudio ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={synthesize} className="gap-1.5 text-xs h-7 px-2">
            <Headphones className="h-3.5 w-3.5" />合成音频
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTextOnly(true)} className="text-xs h-7 px-1.5" title="阅读文本播客">
            阅读
          </Button>
          <Button variant="ghost" size="sm" onClick={generateAndSynthesize} disabled={generating}
            className="text-xs h-7 px-1.5 text-muted-foreground" title="重新生成脚本">
            <RotateCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} />
          </Button>
        </div>
      ) : (
        /* 有脚本有音频 → 播放器 */
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={togglePlay} className="gap-1.5 text-xs h-7 px-2">
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "暂停" : "播放"}
          </Button>
          <div className="w-20 sm:w-32">
            <Slider value={[progress]} onValueChange={(v) => seekTo(Array.isArray(v) ? v[0] : v)} max={100} step={0.5} className="h-1" />
          </div>
          <Button variant="ghost" size="sm" onClick={stopPlayback} className="h-7 w-7 p-0" title="停止">
            <SkipForward className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={generateAndSynthesize} disabled={generating || synthesizing}
            className="text-xs h-7 px-1.5 text-muted-foreground" title="重新生成">
            <RotateCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )}

      {/* 进度指示器 */}
      {hasScript && (playing || currentIdx >= 0) && (
        <div className="hidden sm:flex items-center gap-0.5 ml-1">
          {segments.map((seg, i) => (
            <span key={i} className={`text-[10px] w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
              i === currentIdx
                ? seg.speaker === "小明" ? "bg-[#007AFF] text-white dark:bg-[#0A84FF]" : "bg-[#FF375F] text-white dark:bg-[#FF453A]"
                : i < currentIdx ? "bg-muted text-muted-foreground" : "bg-muted/30 text-muted-foreground/30"
            }`}>{seg.speaker[0]}</span>
          ))}
        </div>
      )}

      {/* Text-only fallback: show conversation */}
      {textOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setTextOnly(false)}>
          <div className="bg-card rounded-xl border shadow-lg max-w-lg w-full mx-4 max-h-[70vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Headphones className="h-4 w-4" />播客文本</h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTextOnly(false)}>关闭</Button>
            </div>
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <div key={i} className={`flex gap-2 text-sm ${seg.speaker === "小明" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    seg.speaker === "小明"
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200"
                      : "bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-200"
                  }`}>
                    <p className="text-[10px] font-medium mb-0.5 opacity-70">{seg.speaker}</p>
                    <p>{seg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
