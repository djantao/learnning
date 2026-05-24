import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, AlertTriangle, Target } from "lucide-react"

export default async function QuizResultPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; quizId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { courseId, moduleId, quizId } = await params

  const quiz = await prisma.moduleQuiz.findUnique({ where: { id: quizId } })
  if (!quiz || quiz.userId !== session.user.id) notFound()

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { id: true, title: true } } },
  })
  if (!mod) notFound()

  const questions = JSON.parse(quiz.questions)
  const results = JSON.parse(quiz.results)
  const diagnosis = quiz.diagnosis ? JSON.parse(quiz.diagnosis) : null
  const isScored = quiz.status === "scored"

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/courses/${courseId}/quiz/${moduleId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold">{mod.title} — 测验结果</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(quiz.createdAt).toLocaleDateString("zh-CN")} · {questions.length} 题
          </p>
        </div>
      </div>

      {isScored && diagnosis && (
        <>
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-lg font-medium">{diagnosis.overall}</p>
              <div className="flex justify-center gap-6 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />掌握 {(diagnosis.strong || []).length}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Target className="h-4 w-4" />熟练 {(diagnosis.medium || []).length}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="h-4 w-4" />薄弱 {(diagnosis.weak || []).length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">知识点诊断</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[...(diagnosis.strong || []), ...(diagnosis.medium || []), ...(diagnosis.weak || [])].map((item: any) => {
                const isWeak = (diagnosis.weak || []).some((w: any) => w.kpId === item.kpId)
                const isMedium = (diagnosis.medium || []).some((m: any) => m.kpId === item.kpId)
                const bg = isWeak ? "border-red-200 bg-red-50" : isMedium ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
                const textColor = isWeak ? "text-red-700" : isMedium ? "text-amber-700" : "text-green-700"
                return (
                  <div key={item.kpId} className={`p-3 rounded-md border ${bg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${textColor}`}>{item.kpTitle}</span>
                      <Badge className={isWeak ? "bg-red-500" : isMedium ? "bg-amber-500" : "bg-green-500"}>
                        {isWeak ? "薄弱" : isMedium ? "熟练" : "掌握"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                    {item.suggestion && (
                      <div className="mt-2 flex items-center gap-2">
                        <Link href={`/courses/${courseId}/learn/${item.kpId}`}>
                          <Button variant="outline" size="sm" className="text-xs h-7">去回补</Button>
                        </Link>
                        <span className="text-xs text-muted-foreground">{item.suggestion}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">逐题详情</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {questions.map((q: any, i: number) => {
                const r = (results || [])[i]
                const correct = r?.isCorrect
                return (
                  <div key={q.id} className={`p-3 rounded-md border ${correct ? "border-green-200" : "border-red-200"}`}>
                    <div className="flex items-start gap-2">
                      <span className={correct ? "text-green-500" : "text-red-500"}>
                        {correct ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{i + 1}. {q.content}</p>
                        {!correct && r && (
                          <div className="mt-1 text-xs space-y-1">
                            <p className="text-muted-foreground">正确答案：{r.correctAnswer}</p>
                            <p className="text-muted-foreground">{r.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}

      {!isScored && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">该测验尚未提交评分</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
