"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  BookX, GraduationCap, Layers, Target, Eye, EyeOff
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

export function QuestionBank({ courses }: { courses: CourseItem[] }) {
  const [expandedKps, setExpandedKps] = useState<Set<string>>(new Set())
  const [showAnswers, setShowAnswers] = useState<Set<string>>(new Set())

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookX className="h-6 w-6 text-rose-500" />
        <div>
          <h2 className="text-xl font-bold">题库</h2>
          <p className="text-sm text-muted-foreground">练习评估后，错题会自动归类到这里</p>
        </div>
        {totalWrong > 0 && (
          <Badge variant="destructive" className="ml-auto">{totalWrong} 道错题</Badge>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <BookX className="h-12 w-12 opacity-20" />
          <p className="text-lg font-medium">暂无题目记录</p>
          <p className="text-sm opacity-60">完成练习评估后，错题会自动归类到这里</p>
          <Link href="/courses" className="text-primary text-sm hover:underline mt-2">
            去学习课程 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <div key={course.courseId} className="rounded-xl border bg-card">
              <div className="flex items-center gap-2 px-4 py-3 border-b">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{course.courseTitle}</span>
              </div>
              <div className="p-3 space-y-2">
                {course.modules.map((mod) => (
                  <div key={mod.moduleId}>
                    <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" />
                      {mod.moduleTitle}
                    </div>
                    {mod.knowledgePoints.map((kp) => (
                      <div key={kp.kpId} className="ml-3">
                        <button
                          onClick={() => toggleKp(kp.kpId)}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-left"
                        >
                          <Target className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                          <span className="flex-1 font-medium">{kp.kpTitle}</span>
                          <Badge variant="outline" className="text-xs border-rose-200 text-rose-600">
                            {kp.wrongCount} 题
                          </Badge>
                        </button>
                        {expandedKps.has(kp.kpId) && (
                          <div className="ml-4 mt-1 space-y-2 mb-2">
                            {kp.entries.map((entry, idx) => (
                              <div key={entry.recordId} className="rounded-lg border bg-muted/30 p-3 text-sm">
                                <p className="font-medium mb-2">
                                  <span className="text-muted-foreground mr-1">Q{idx + 1}.</span>
                                  {entry.question}
                                </p>
                                <p className="text-rose-600 mb-1">
                                  <span className="font-medium">你的回答：</span>{entry.userAnswer}
                                </p>
                                {showAnswers.has(entry.recordId) ? (
                                  <div className="mt-2 pt-2 border-t space-y-1">
                                    <p className="text-emerald-600">
                                      <span className="font-medium">正确答案：</span>{entry.correctAnswer}
                                    </p>
                                    <p className="text-muted-foreground text-xs">{entry.explanation}</p>
                                  </div>
                                ) : null}
                                <div className="flex items-center gap-3 mt-2">
                                  <button
                                    onClick={() => toggleAnswer(entry.recordId)}
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {showAnswers.has(entry.recordId) ? (
                                      <><EyeOff className="h-3.5 w-3.5" /> 隐藏答案</>
                                    ) : (
                                      <><Eye className="h-3.5 w-3.5" /> 查看答案</>
                                    )}
                                  </button>
                                  <Link
                                    href={`/courses/${course.courseId}/learn/${kp.kpId}`}
                                    className="text-xs text-primary hover:underline ml-auto"
                                  >
                                    去练习 →
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
