import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { QuizTaker } from "@/components/quiz/quiz-taker"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Sparkles } from "lucide-react"
import { GenerateQuizButton } from "./generate-button"

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { courseId, moduleId } = await params

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { id: true, userId: true } } },
  })
  if (!mod || mod.course.userId !== session.user.id) notFound()

  const pendingQuiz = await prisma.moduleQuiz.findFirst({
    where: { moduleId, userId: session.user.id, status: "generated" },
    orderBy: { createdAt: "desc" },
  })

  const lastScored = await prisma.moduleQuiz.findFirst({
    where: { moduleId, userId: session.user.id, status: "scored" },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/courses/${courseId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold">{mod.title} — 模块测验</h2>
          {lastScored && (
            <p className="text-xs text-muted-foreground">
              上次测验：{new Date(lastScored.createdAt).toLocaleDateString("zh-CN")}
              {" "}<Link href={`/courses/${courseId}/quiz/${moduleId}/result/${lastScored.id}`} className="text-primary underline">查看结果</Link>
            </p>
          )}
        </div>
      </div>

      {pendingQuiz ? (
        <QuizTaker
          moduleId={moduleId} courseId={courseId}
          quizId={pendingQuiz.id} questions={JSON.parse(pendingQuiz.questions)}
          moduleTitle={mod.title}
        />
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Sparkles className="h-10 w-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">开始模块综合测验</p>
              <p className="text-xs text-muted-foreground mt-1">AI 将为你生成一套覆盖该模块所有知识点的测验题</p>
            </div>
            <GenerateQuizButton moduleId={moduleId} courseId={courseId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
