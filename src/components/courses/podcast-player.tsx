"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Play, Pause, SkipForward, Headphones, VolumeX } from "lucide-react"
import { toast } from "sonner"

interface Segment {
  speaker: string
  text: string
}

export function PodcastPlayer({ knowledgePointId }: { knowledgePointId: string }) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [voicesReady, setVoicesReady] = useState(false)
  const playingRef = useRef(false)
  const cancelRef = useRef(false)

  // 等待语音库加载完成
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      setVoicesReady(true)
      return
    }

    const onVoicesChanged = () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoicesReady(true)
      }
    }
    window.speechSynthesis.onvoiceschanged = onVoicesChanged
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  function pickVoice(gender: "male" | "female"): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return null

    const zhVoices = voices.filter((v) => v.lang.startsWith("zh"))
    if (zhVoices.length > 0) {
      if (gender === "female") {
        return zhVoices.find((v) => v.name.includes("Huihui") || v.name.toLowerCase().includes("female")) || zhVoices[0]
      }
      return zhVoices.find((v) => v.name.includes("Yunyang") || v.name.toLowerCase().includes("male")) || zhVoices[0]
    }

    return voices.find((v) => v.default) || voices[0]
  }

  const speakSegment = useCallback(
    (idx: number): void => {
      if (idx >= segments.length || cancelRef.current || !playingRef.current) {
        setPlaying(false)
        playingRef.current = false
        setCurrentIdx(-1)
        return
      }

      const seg = segments[idx]
      if (!seg) {
        speakSegment(idx + 1)
        return
      }

      const voice = pickVoice(seg.speaker === "小明" ? "male" : "female")

      const u = new SpeechSynthesisUtterance(seg.text)
      u.lang = "zh-CN"
      u.rate = 1.05
      u.volume = 1
      if (voice) u.voice = voice

      u.onstart = () => {
        setCurrentIdx(idx)
      }

      u.onend = () => {
        if (!cancelRef.current && playingRef.current) {
          speakSegment(idx + 1)
        }
      }

      u.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.warn("Speech error:", e.error)
        }
        if (!cancelRef.current && playingRef.current) {
          speakSegment(idx + 1)
        }
      }

      window.speechSynthesis.speak(u)
    },
    [segments],
  )

  const startPlayback = useCallback(() => {
    if (segments.length === 0 || !voicesReady) return
    window.speechSynthesis.cancel()
    cancelRef.current = false
    playingRef.current = true
    setPlaying(true)
    speakSegment(0)
  }, [segments, speakSegment, voicesReady])

  const pausePlayback = useCallback(() => {
    window.speechSynthesis.pause()
    setPlaying(false)
    playingRef.current = false
  }, [])

  const resumePlayback = useCallback(() => {
    playingRef.current = true
    setPlaying(true)
    window.speechSynthesis.resume()
  }, [])

  const stopPlayback = useCallback(() => {
    cancelRef.current = true
    window.speechSynthesis.cancel()
    setPlaying(false)
    playingRef.current = false
    setCurrentIdx(-1)
  }, [])

  async function generate() {
    setLoading(true)
    stopPlayback()
    try {
      const res = await fetch("/api/ai/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePointId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "播客生成失败")
        return
      }
      const data = await res.json()
      if (!data.segments || data.segments.length === 0) {
        toast.error("播客内容为空，请重试")
        return
      }
      setSegments(data.segments || [])
      setTitle(data.title || "")
      toast.success("播客已生成，点击播放")
    } catch {
      toast.error("播客生成失败")
    }
    setLoading(false)
  }

  const supported = typeof window !== "undefined" && "speechSynthesis" in window

  if (!supported) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs">
        <VolumeX className="h-3.5 w-3.5" />
        不支持语音
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {segments.length === 0 ? (
        <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="gap-1.5 text-xs">
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              生成播客...
            </>
          ) : (
            <>
              <Headphones className="h-3.5 w-3.5" />
              播客
            </>
          )}
        </Button>
      ) : (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={playing ? pausePlayback : resumePlayback}
            disabled={!voicesReady}
            className="gap-1.5 text-xs h-7 px-2"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "暂停" : voicesReady ? "播放" : "加载语音..."}播客
          </Button>
          <Button variant="ghost" size="sm" onClick={stopPlayback} className="h-7 w-7 p-0" title="停止">
            <SkipForward className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={generate}
            disabled={loading}
            className="text-xs h-7 px-1.5 text-muted-foreground"
            title="重新生成"
          >
            <Loader2 className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )}

      {segments.length > 0 && (playing || currentIdx >= 0) && (
        <div className="flex items-center gap-1 ml-2">
          {segments.map((seg, i) => (
            <span
              key={i}
              className={`text-xs w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                i === currentIdx
                  ? seg.speaker === "小明"
                    ? "bg-blue-500 text-white"
                    : "bg-pink-500 text-white"
                  : i < currentIdx
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/30 text-muted-foreground/30"
              }`}
            >
              {seg.speaker[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
