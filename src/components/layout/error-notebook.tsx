"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronLeft, ChevronRight, BookX, Loader2,
  GraduationCap, Layers, Target, Eye, EyeOff
} from "lucide-react"

interface WrongEntry {
  recordId: string
  question: string
  userAnswer: string
  correctAnswer: string
  explanation: string
  createdAt: string
}

interface KPItem {
  kpId: string
  kpTitle: string
  wrongCount: number
  entries: WrongEntry[]
}

interface ModuleItem {
  moduleId: string
  moduleTitle: string
  knowledgePoints: KPItem[]
}

interface CourseItem {
  courseId: string
  courseTitle: string
  modules: ModuleItem[]
}

export function ErrorNotebook() {
  const [open, setOpen] = useState(true)
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedKps, setExpandedKps] = useState<Set<string>>(new Set())
  const [showAnswers, setShowAnswers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetch("/api/review/errors")
        .then((r) => r.json())
        .then((d) => setCourses(d.courses ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [open])

  const toggleKp = (kpId: string) => {
    setExpandedKps((prev) => {
      const next = new Set(prev)
      if (next.has(kpId)) { next.delete(kpId) } else { next.add(kpId) }
      return next
    })
  }

  const toggleAnswer = (recordId: string) => {
    setShowAnswers((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) { next.delete(recordId) } else { next.add(recordId) }
      return next
    })
  }

  const totalWrong = courses.reduce(
    (sum, c) => sum + c.modules.reduce(
      (s, m) => s + m.knowledgePoints.reduce((s2, kp) => s2 + kp.wrongCount, 0), 0
    ), 0
  )

  return (
    <>
      {/* Panel */}
      <div className={cn(
        "flex-col border-r bg-card transition-all duration-200",
        open ? "flex w-80 shrink-0" : "hidden"
      )}>
        <div className="flex items-center justify-between px-3 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <BookX className="h-4 w-4 text-rose-500" />
            <span className="font-semibold text-sm">题库</span>
            {totalWrong > 0 && (
              <Badge variant="destructive" className="text-xs">{totalWrong}</Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <BookX className="h-8 w-8 opacity-30" />
              <p className="text-xs">暂无题目记录</p>
              <p className="text-xs opacity-60">完成练习评估后，错题会自动归类到这里</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {courses.map((course) => (
                <div key={course.courseId} className="mb-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {course.courseTitle}
                  </div>
                  {course.modules.map((mod) => (
                    <div key={mod.moduleId}>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground/70 ml-2">
                        <Layers className="h-3 w-3" />
                        {mod.moduleTitle}
                      </div>
                      {mod.knowledgePoints.map((kp) => (
                        <div key={kp.kpId} className="ml-3">
                          <button
                            onClick={() => toggleKp(kp.kpId)}
                            className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors text-left"
                          >
                            <Target className="h-3 w-3 text-rose-400 shrink-0" />
                            <span className="flex-1 truncate">{kp.kpTitle}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-rose-200 text-rose-600">
                              {kp.wrongCount}
                            </Badge>
                          </button>
                          {expandedKps.has(kp.kpId) && (
                            <div className="ml-2 mt-1 space-y-1.5 mb-2">
                              {kp.entries.map((entry) => (
                                <div key={entry.recordId} className="rounded-md border bg-muted/30 p-2 text-xs">
                                  <p className="font-medium mb-1">{entry.question}</p>
                                  <p className="text-rose-600 mb-0.5">
                                    <span className="font-medium">你的回答：</span>{entry.userAnswer}
                                  </p>
                                  {showAnswers.has(entry.recordId) && (
                                    <>
                                      <p className="text-emerald-600 mb-0.5">
                                        <span className="font-medium">正确答案：</span>{entry.correctAnswer}
                                      </p>
                                      <p className="text-muted-foreground">{entry.explanation}</p>
                                    </>
                                  )}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <button
                                      onClick={() => toggleAnswer(entry.recordId)}
                                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      {showAnswers.has(entry.recordId) ? (
                                        <><EyeOff className="h-3 w-3" /> 隐藏答案</>
                                      ) : (
                                        <><Eye className="h-3 w-3" /> 查看答案</>
                                      )}
                                    </button>
                                    <Link
                                      href={`/courses/${course.courseId}/learn/${kp.kpId}`}
                                      className="text-primary hover:underline ml-auto"
                                    >
                                      去练习
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Collapsed toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 w-10 flex flex-col items-center justify-center gap-1 bg-card border-r hover:bg-muted transition-colors group"
          title="打开题库"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          <BookX className="h-4 w-4 text-rose-400" />
          {totalWrong > 0 && (
            <span className="text-[10px] font-bold text-rose-500">{totalWrong}</span>
          )}
          <span className="text-[9px] text-muted-foreground leading-tight text-center">题库</span>
        </button>
      )}
    </>
  )
}
