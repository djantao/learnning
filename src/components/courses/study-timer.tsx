"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Play, Pause } from "lucide-react"

interface StudyTimerProps {
  onFlush?: (totalSeconds: number) => void
}

export function StudyTimer({ onFlush }: StudyTimerProps) {
  const [seconds, setSeconds] = useState(0)
  const [paused, setPaused] = useState(false)
  const startRef = useRef(Date.now())
  const accumulatedRef = useRef(0)

  const flush = useCallback(() => {
    const elapsed = accumulatedRef.current + (paused ? 0 : Math.floor((Date.now() - startRef.current) / 1000))
    if (elapsed > 0) onFlush?.(elapsed)
    accumulatedRef.current = 0
    startRef.current = Date.now()
    setSeconds(0)
  }, [paused, onFlush])

  // Reset on mount
  useEffect(() => {
    accumulatedRef.current = 0
    startRef.current = Date.now()
    setSeconds(0)
    setPaused(false)
  }, [])

  // Tick every second
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setSeconds(accumulatedRef.current + Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [paused])

  // Heartbeat: report 30s every 30s
  useEffect(() => {
    if (paused) return
    const hb = setInterval(() => {
      fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studySeconds: 30 }),
      }).catch(() => {})
    }, 30000)
    return () => clearInterval(hb)
  }, [paused])

  // Flush on unmount
  useEffect(() => {
    return () => { flush() }
  }, [flush])

  function togglePause() {
    if (paused) {
      startRef.current = Date.now()
      setPaused(false)
    } else {
      accumulatedRef.current += Math.floor((Date.now() - startRef.current) / 1000)
      setPaused(true)
    }
  }

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

  return (
    <button
      onClick={togglePause}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all select-none",
        paused
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50"
          : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50"
      )}
      title={paused ? "继续计时" : "暂停计时"}
    >
      {paused ? (
        <Play className="h-3.5 w-3.5" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      )}
      <span className="font-mono tabular-nums">{display}</span>
    </button>
  )
}
