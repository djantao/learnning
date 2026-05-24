import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Brain, BookOpen, MessageSquare, TrendingUp, Target, AlertTriangle, Star, GraduationCap, Clock, CheckCircle2, ArrowRight } from "lucide-react"
import { getTodayModules } from "@/lib/schedule"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = session.user.id
  const userName = session.user.name ?? session.user.email ?? "同学"

  // Real data queries - run in parallel
  const [
    dueCardsCount,
    totalCardsCount,
    masteredCount,
    recentNotes,
    recentConversations,
    goals,
    blindSpots,
    todayActivity,
    activityDates,
    lastStudiedKp,
    todaySchedule,
  ] = await Promise.all([
    prisma.flashcard.count({ where: { userId, isSuspended: false, sm2NextReview: { lte: new Date() } } }),
    prisma.flashcard.count({ where: { userId, isSuspended: false } }),
    prisma.flashcard.count({ where: { userId, isSuspended: false, sm2Interval: { gte: 21 } } }),
    prisma.page.findMany({ where: { userId, isArchived: false }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, updatedAt: true, tags: { include: { tag: true } } } }),
    prisma.conversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, messageCount: true, updatedAt: true } }),
    prisma.learningGoal.findMany({ where: { userId, parentGoalId: null }, take: 4, orderBy: { sortOrder: "asc" }, include: { childGoals: { include: { course: { select: { id: true, title: true } } } }, course: { select: { id: true, title: true } } } }),
    prisma.blindSpot.findMany({ where: { userId, isResolved: false }, orderBy: { severity: "desc" }, take: 4 }),
    prisma.dailyActivity.findFirst({ where: { userId, date: new Date(new Date().toDateString()) as any } }),
    prisma.dailyActivity.findMany({ where: { userId }, orderBy: { date: "desc" }, select: { date: true }, take: 60 }),
    prisma.knowledgePoint.findFirst({
      where: { status: "in_progress", module: { course: { userId } } },
      orderBy: { updatedAt: "desc" },
      include: { module: { include: { course: { select: { id: true, title: true } } } } },
    }),
    getTodayModules(userId),
  ])

  const cardsDue = dueCardsCount
  const cardsTotal = totalCardsCount

  // Calculate consecutive-day streak
  let streak = 0
  const today = new Date(new Date().toDateString())
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const dateStr = checkDate.toDateString()
    if (activityDates.some((a) => new Date(a.date).toDateString() === dateStr)) {
      streak++
    } else if (i === 0) {
      // Today has no activity yet — streak checks from yesterday
      continue
    } else {
      break
    }
  }

  // Format relative time
  function timeAgo(date: Date): string {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (mins < 60) return `${mins} 分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} 天前`
    return `${Math.floor(days / 7)} 周前`
  }

  return (
    <div className="space-y-6">
      {/* Review Reminder Banner */}
      {dueCardsCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-semibold">你有 {dueCardsCount} 张卡片等待复习</p>
              <p className="text-sm text-muted-foreground">间隔重复是长期记忆的关键，现在花几分钟复习一下吧</p>
            </div>
          </div>
          <Link href="/review/session">
            <Button className="shrink-0">开始复习</Button>
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">欢迎回来，{userName}</h2>
          <p className="text-muted-foreground">继续你的学习之旅</p>
        </div>
        {streak > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            <TrendingUp className="mr-1 h-4 w-4 text-orange-500" />
            {streak} 天活跃
          </Badge>
        )}
      </div>

      {/* Continue Learning Card */}
      {lastStudiedKp ? (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 hover:shadow-md transition-shadow">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen className="h-6 w-6 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">继续学习</p>
                <p className="font-semibold truncate">
                  {lastStudiedKp.module.course.title} / {lastStudiedKp.module.title} / {lastStudiedKp.title}
                </p>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= (lastStudiedKp as any).mastery ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>
            </div>
            <Link href={`/courses/${lastStudiedKp.module.course.id}/learn/${lastStudiedKp.id}`}>
              <Button className="shrink-0" size="sm">继续学习</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">还没有开始学习</p>
            <Link href="/courses">
              <Button variant="outline" size="sm" className="mt-3">开始你的第一门课程</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待复习</CardTitle>
            <Brain className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cardsDue > 0 ? cardsDue : "🎉"}
              {cardsTotal > 0 && <span className="text-sm font-normal text-muted-foreground"> / {cardsTotal}</span>}
            </div>
            {cardsTotal > 0 && (
              <>
                <Progress value={cardsDue > 0 ? Math.max(5, (cardsDue / cardsTotal) * 100) : 100} className="mt-2 h-2" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {cardsDue === 0 ? "全部掌握！" : `${masteredCount} 张已掌握`}
                </p>
              </>
            )}
            {cardsDue > 0 && (
              <Link href="/review/session">
                <Button className="mt-3 w-full" size="sm">开始复习 {cardsDue} 张卡片</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">笔记</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayActivity?.notesCreated ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">今日新增</p>
            <Link href="/notes/new">
              <Button className="mt-3 w-full" size="sm" variant="outline">写新笔记</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI 对话</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayActivity?.aiConversations ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">今日对话</p>
            <Link href="/chat">
              <Button className="mt-3 w-full" size="sm" variant="outline">开始对话</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">学习时长</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayActivity?.studyMinutes ?? 0}
              <span className="text-sm font-normal text-muted-foreground"> 分钟</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">今日累计</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      {todaySchedule.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              今日学习
            </CardTitle>
            <Link href="/schedule">
              <Button variant="ghost" size="sm" className="gap-1">
                完整课表 <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todaySchedule.map((m) => {
                const isOverdue = m.status !== "completed"
                const isDone = m.status === "completed"
                return (
                  <Link key={m.id} href={`/courses/${m.course.id}/learn/${m.id}`}>
                    <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 ${isDone ? "bg-muted/50" : "bg-card"}`}>
                      <div className={`shrink-0 h-8 w-8 rounded-md flex items-center justify-center text-sm`}
                        style={{ backgroundColor: `${m.course.color}20`, color: m.course.color }}>
                        {m.course.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{m.title}</span>
                          {isDone ? (
                            <Badge className="bg-green-500 hover:bg-green-600 text-[10px] shrink-0">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />已完成
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] shrink-0">待完成</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.course.title}
                          {m.estimatedMinutes ? ` · ~${m.estimatedMinutes}分钟` : ""}
                        </p>
                      </div>
                      {m.status === "in_progress" && (
                        <Progress value={m.progressPct} className="h-1.5 w-16 shrink-0" />
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Learning Goals / Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              我的项目
            </CardTitle>
            <Link href="/goals">
              <Button variant="ghost" size="sm">管理</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.length > 0 ? (
              <>
                <div className="flex gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <span>{goals.length} 个项目</span>
                  <span>·</span>
                  <span>{goals.reduce((s: number, g: any) => s + (g.course ? 1 : 0) + g.childGoals.filter((c: any) => c.course).length, 0)} 门课程</span>
                  <span>·</span>
                  <span>本周 {todayActivity?.studyMinutes ?? 0} 分钟</span>
                </div>
                {goals.map((goal) => {
                  const courseCount = (goal.course ? 1 : 0) + goal.childGoals.filter((c: any) => c.course).length
                  const courseNames: string[] = []
                  if (goal.course) courseNames.push(goal.course.title)
                  for (const child of (goal.childGoals || [])) {
                    if (child.course) courseNames.push(child.course.title)
                  }
                  return (
                  <Link key={goal.id} href={`/goals/${goal.id}`} className="block rounded-lg p-3 hover:bg-muted transition-colors border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-sm truncate">{goal.title}</p>
                        {courseCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">{courseCount} 门课程</Badge>
                        )}
                      </div>
                      <span className="text-sm font-semibold shrink-0">{Math.round(goal.progressPct)}%</span>
                    </div>
                    <Progress value={goal.progressPct} className="h-2 mb-2" />
                    {courseNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {courseNames.slice(0, 3).map((name, i) => (
                          <span key={i} className="bg-muted px-1.5 py-0.5 rounded">{name}</span>
                        ))}
                        {courseNames.length > 3 && <span>+{courseNames.length - 3}</span>}
                      </div>
                    )}
                  </Link>
                  )
                })}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">还没有学习目标</p>
                <Link href="/goals">
                  <Button variant="outline" size="sm" className="mt-2">创建目标</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blind Spots */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              知识盲区
            </CardTitle>
            <div className="flex gap-1">
              <form action={async () => {
                "use server"
                const { prisma } = await import("@/lib/db")
                const session = await import("@/lib/auth").then(m => m.auth())
                if (!session?.user?.id) return
                // Trigger blind spot detection (client-side will handle this)
              }}>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {blindSpots.length > 0 ? blindSpots.map((spot) => (
              <div key={spot.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{spot.topic}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{spot.description || spot.suggestion}</p>
                  <Progress value={spot.severity * 100} className="mt-1 h-1.5 w-24" />
                </div>
                <Badge variant={spot.severity > 0.6 ? "destructive" : "secondary"} className="text-xs shrink-0 ml-2">
                  {Math.round(spot.severity * 100)}%
                </Badge>
              </div>
            )) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">没有检测到的盲区</p>
                <p className="text-xs text-muted-foreground mt-1">积累更多复习记录后，AI 将帮你分析</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">最近笔记</CardTitle>
            <Link href="/notebooks">
              <Button variant="ghost" size="sm">查看全部</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentNotes.length > 0 ? (
              <div className="space-y-3">
                {recentNotes.map((note) => (
                  <Link key={note.id} href={`/notes/${note.id}`} className="block rounded-lg p-3 hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{note.title}</p>
                      <span className="text-xs text-muted-foreground">{timeAgo(note.updatedAt)}</span>
                    </div>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {note.tags.map((pt) => (
                          <Badge key={pt.tag.id} variant="secondary" className="text-[10px]">{pt.tag.name}</Badge>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">还没有笔记</p>
                <Link href="/notes/new">
                  <Button variant="outline" size="sm" className="mt-2">写第一篇笔记</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent AI Conversations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">最近 AI 对话</CardTitle>
            <Link href="/chat">
              <Button variant="ghost" size="sm">新对话</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentConversations.length > 0 ? (
              <div className="space-y-3">
                {recentConversations.map((conv) => (
                  <Link key={conv.id} href={`/chat`} className="block rounded-lg p-3 hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{conv.title || "无标题"}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(conv.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{conv.messageCount} 条消息</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">还没有 AI 对话</p>
                <Link href="/chat">
                  <Button variant="outline" size="sm" className="mt-2">开始与 AI 对话</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
