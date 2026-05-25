"use client"

import { useState, useEffect } from "react"
import { XP_PER_KP_MASTERED, CELEBRATION_MESSAGES, xpToLevel, xpProgressInLevel, getLevelTitle } from "@/lib/gamification"
import { Star, Zap, Award } from "lucide-react"

interface XpCelebrationProps {
  show: boolean
  xpGained: number
  totalXp: number
  onClose: () => void
}

export function XpCelebration({ show, xpGained, totalXp, onClose }: XpCelebrationProps) {
  const [visible, setVisible] = useState(false)
  const [stage, setStage] = useState<"hidden" | "counting" | "levelup" | "done">("hidden")

  const level = xpToLevel(totalXp)
  const levelTitle = getLevelTitle(level)
  const progress = xpProgressInLevel(totalXp)
  const message = CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)]

  useEffect(() => {
    if (!show) return
    setVisible(true)
    setStage("counting")

    const t1 = setTimeout(() => setStage("levelup"), 1500)
    const t2 = setTimeout(() => {
      setStage("done")
      setTimeout(() => {
        setVisible(false)
        onClose()
      }, 2000)
    }, 3000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [show, onClose])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto bg-card border rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-4">
          {stage === "counting" && (
            <div className="relative">
              <Star className="h-16 w-16 text-yellow-400 animate-bounce" />
              <Zap className="h-8 w-8 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
          )}
          {stage === "levelup" && (
            <div className="relative">
              <Award className="h-16 w-16 text-primary animate-bounce" />
              <span className="absolute -top-1 -right-1 text-2xl animate-ping">✨</span>
            </div>
          )}
          {stage === "done" && (
            <div className="text-5xl animate-bounce">🎉</div>
          )}
        </div>

        <div className="text-center space-y-2">
          {stage === "counting" && (
            <>
              <p className="text-xl font-bold">{message}</p>
              <p className="text-sm text-muted-foreground">
                获得 <span className="text-primary font-bold">+{xpGained} XP</span>
              </p>
            </>
          )}
          {stage === "levelup" && (
            <>
              <p className="text-xl font-bold">升级了！</p>
              <p className="text-2xl font-bold text-primary">
                等级 {level} · {levelTitle}
              </p>
              <div className="w-full bg-muted rounded-full h-2.5 mt-3">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {totalXp} / {level * level * 100} XP
              </p>
            </>
          )}
          {stage === "done" && (
            <>
              <p className="text-lg font-bold text-muted-foreground">继续学习吧！</p>
              <p className="text-xs text-muted-foreground">
                总经验: {totalXp} XP · 等级 {level}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
