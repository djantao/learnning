"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2, Play, Pause, SkipForward, Headphones, RotateCw } from "lucide-react"
import { toast } from "sonner"

interface Segment {
  speaker: string
  text: string
}

export function PodcastPlayer({ knowledgePointId }: { knowledgePointId: string }) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 加载已有播客（持久化）
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
          if (data.audioBase64) {
            const blob = base64ToBlob(data.audioBase64, "audio/mp3")
            setAudioUrl(URL.createObjectURL(blob))
          }
        }
      } catch { /* 静默失败 */ }
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

  // 创建 audio 元素并绑定事件
  useEffect(() => {
    if (!audioUrl) return
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.ontimeupdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
      if (duration > 0) {
        const pct = audio.currentTime / duration
        setCurrentIdx(Math.min(Math.floor(pct * segments.length), segments.length - 1))
      }
    }
    audio.onended = () => { setPlaying(false); setCurrentIdx(-1); setProgress(0) }
    audio.onerror = () => { toast.error("音频播放失败"); setPlaying(false) }

    return () => { audio.pause(); audio.src = "" }
  }, [audioUrl, duration, segments.length])

  async function generate() {
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
        return
      }
      const data = await res.json()
      if (!data.segments?.length) { toast.error("播客内容为空"); return }
      setSegments(data.segments)
      setTitle(data.title)
      setDuration(data.duration || 0)
      if (data.audioBase64) {
        const blob = base64ToBlob(data.audioBase64, "audio/mp3")
        setAudioUrl(URL.createObjectURL(blob))
      }
      toast.success("播客已生成！")
    } catch {
      toast.error("播客生成失败")
    }
    setGenerating(false)
  }

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
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

  const hasPodcast = segments.length > 0

  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />加载中...
        </Button>
      ) : !hasPodcast ? (
        <Button variant="ghost" size="sm" onClick={generate} disabled={generating} className="gap-1.5 text-xs">
          {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />生成播客...</>
            : <><Headphones className="h-3.5 w-3.5" />播客</>}
        </Button>
      ) : (
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
          <Button variant="ghost" size="sm" onClick={generate} disabled={generating}
            className="text-xs h-7 px-1.5 text-muted-foreground" title="重新生成">
            <RotateCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )}
      {hasPodcast && (playing || currentIdx >= 0) && (
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
    </div>
  )
}
