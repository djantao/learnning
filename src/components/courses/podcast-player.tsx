"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Play, Pause, SkipForward, Headphones } from "lucide-react"
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
  const currentIdxRef = useRef(-1)
  const playingRef = useRef(false)
  const voicesReady = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const loadVoices = () => {
      window.speechSynthesis.getVoices()
      voicesReady.current = true
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  function getVoices(): { male: SpeechSynthesisVoice | null; female: SpeechSynthesisVoice | null } {
    const voices = window.speechSynthesis.getVoices()
    const huihui = voices.find((v) => v.name.includes("Huihui")) || voices.find((v) => v.lang === "zh-CN" && v.name.includes("Female"))
    const yunyang = voices.find((v) => v.name.includes("Yunyang")) || voices.find((v) => v.lang === "zh-CN" && v.name.includes("Male"))
    const zhVoices = voices.filter((v) => v.lang.startsWith("zh"))
    return {
      female: huihui || zhVoices[0] || null,
      male: yunyang || zhVoices[1] || zhVoices[0] || null,
    }
  }

  const speakSegment = useCallback(
    (idx: number): Promise<void> => {
      return new Promise((resolve) => {
        if (idx >= segments.length || !playingRef.current) {
          setCurrentIdx(-1)
          currentIdxRef.current = -1
          setPlaying(false)
          playingRef.current = false
          resolve()
          return
        }

        const seg = segments[idx]
        const { male, female } = getVoices()
        const voice = seg.speaker === "小明" ? male : female

        const u = new SpeechSynthesisUtterance(seg.text)
        u.lang = "zh-CN"
        u.rate = 1.05
        if (voice) u.voice = voice
        u.onend = () => {
          currentIdxRef.current = idx + 1
          setCurrentIdx(idx + 1)
          resolve(speakSegment(idx + 1))
        }
        u.onerror = () => {
          currentIdxRef.current = idx + 1
          setCurrentIdx(idx + 1)
          resolve(speakSegment(idx + 1))
        }

        window.speechSynthesis.speak(u)
      })
    },
    [segments],
  )

  const startPlayback = useCallback(async () => {
    if (segments.length === 0) return
    window.speechSynthesis.cancel()
    playingRef.current = true
    setPlaying(true)
    currentIdxRef.current = 0
    setCurrentIdx(0)
    await speakSegment(0)
  }, [segments, speakSegment])

  const pausePlayback = useCallback(() => {
    window.speechSynthesis.pause()
    setPlaying(false)
    playingRef.current = false
  }, [])

  const resumePlayback = useCallback(async () => {
    playingRef.current = true
    setPlaying(true)
    window.speechSynthesis.resume()
  }, [])

  const stopPlayback = useCallback(() => {
    window.speechSynthesis.cancel()
    setPlaying(false)
    playingRef.current = false
    setCurrentIdx(-1)
    currentIdxRef.current = -1
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
      setSegments(data.segments || [])
      setTitle(data.title || "")
      toast.success("播客已生成，点击播放")
    } catch {
      toast.error("播客生成失败")
    }
    setLoading(false)
  }

  const supported = typeof window !== "undefined" && "speechSynthesis" in window

  if (!supported) return null

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
            className="gap-1.5 text-xs h-7 px-2"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "暂停" : "播放"}播客
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
