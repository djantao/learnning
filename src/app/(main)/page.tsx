import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Brain, BookOpen, MessageSquare, TrendingUp, Target, AlertTriangle, Star, GraduationCap, Clock, CheckCircle2, ArrowRight, AlertCircle, Flame, Zap } from "lucide-react"
import { getTodayModules, rebalanceSchedule } from "@/lib/schedule"
import { ResumeButton } from "@/components/courses/resume-button"
import { StreakCalendar } from "@/components/dashboard/streak-calendar"
import { DailyChecklist } from "@/components/dashboard/daily-checklist"
import { OverdueActions } from "@/components/dashboard/overdue-actions"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = session.user.id
  const userName = session.user.name ?? session.user.email ?? "同学"

  // 后台执行逾期重新排期，不阻塞页面加载
  rebalanceSchedule(userId).catch(() => {})

  // Real data queries - run in parallel
  // 逾期模块：排期在今天之前但未完成
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

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
    overdueModules,
    weeklyCompletedKps,
    resumeUser,
    todayKpReviews,
    reviewLogDates,
    dueKpCount,
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
    prisma.module.findMany({
      where: { course: { userId }, scheduledDate: { lt: now }, status: { not: "completed" } },
      include: { course: { select: { id: true, title: true, icon: true, color: true } } },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.knowledgePoint.findMany({
      where: { module: { course: { userId } }, completedAt: { gte: startOfWeek, lt: endOfWeek } },
      include: { module: { include: { course: { select: { id: true, title: true, icon: true, color: true } } } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { resumeCourseId: true, resumeKpId: true, resumeUpdatedAt: true },
    }),
    prisma.kpReviewLog.count({ where: { userId, createdAt: { gte: new Date(new Date().toDateString()) } } }),
    prisma.kpReviewLog.findMany({ where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 90 }),
    prisma.knowledgePoint.count({ where: { module: { course: { userId } }, mastery: { gte: 4 }, sm2NextReview: { lte: new Date() } } }),
  ])

  // Fetch resume position details if available
  let resumePosition: { courseId: string; courseTitle: string; courseIcon: string; courseColor: string; kpId: string; kpTitle: string; moduleId: string; updatedAt: string } | null = null
  if (resumeUser?.resumeCourseId && resumeUser?.resumeKpId) {
    const [resumeCourse, resumeKp] = await Promise.all([
      prisma.course.findUnique({ where: { id: resumeUser.resumeCourseId }, select: { id: true, title: true, icon: true, color: true } }),
      prisma.knowledgePoint.findUnique({ where: { id: resumeUser.resumeKpId }, select: { id: true, title: true, moduleId: true } }),
    ])
    if (resumeCourse && resumeKp) {
      resumePosition = {
        courseId: resumeCourse.id,
        courseTitle: resumeCourse.title,
        courseIcon: resumeCourse.icon,
        courseColor: resumeCourse.color,
        kpId: resumeKp.id,
        kpTitle: resumeKp.title,
        moduleId: resumeKp.moduleId,
        updatedAt: resumeUser.resumeUpdatedAt?.toISOString() ?? "",
      }
    }
  }

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
      continue
    } else {
      break
    }
  }

  // Review streak (consecutive days with at least one review)
  let reviewStreak = 0
  const reviewDateSet = new Set(reviewLogDates.map((l) => new Date(l.createdAt).toDateString()))
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    if (reviewDateSet.has(checkDate.toDateString())) {
      reviewStreak++
    } else if (i === 0) {
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
    <div className="space-y-4 sm:space-y-6">
      {/* Review Reminder Banner */}
      {(dueCardsCount > 0 || dueKpCount > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-semibold">
                {dueCardsCount > 0 && dueKpCount > 0
                  ? `你有 ${dueCardsCount} 张闪卡和 ${dueKpCount} 个知识点等待复习`
                  : dueCardsCount > 0
                    ? `你有 ${dueCardsCount} 张闪卡等待复习`
                    : `你有 ${dueKpCount} 个知识点等待复习`
                }
              </p>
              <p className="text-sm text-muted-foreground">间隔重复是长期记忆的关键，现在花几分钟复习一下吧</p>
            </div>
          </div>
          <Link href="/review">
            <Button className="shrink-0">开始复习</Button>
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">欢迎回来，{userName}</h2>
          <p className="text-muted-foreground">继续你的学习之旅</p>
        </div>
        {streak > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            <TrendingUp className="mr-1 h-4 w-4 text-orange-500" />
            {streak} 天活跃
          </Badge>
        )}
      </div>

      {/* Continue Learning Card — prefer resume position */}
      {resumePosition ? (
        <Card className="bg-gradient-to-r from-violet-500/5 to-purple-500/10 border-violet-500/20 hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-medium text-violet-600 dark:text-violet-400">继续学习</p>
            </div>
            <ResumeButton
              courseId={resumePosition.courseId}
              courseTitle={resumePosition.courseTitle}
              courseIcon={resumePosition.courseIcon}
              courseColor={resumePosition.courseColor}
              kpId={resumePosition.kpId}
              kpTitle={resumePosition.kpTitle}
              moduleId={resumePosition.moduleId}
              updatedAt={resumePosition.updatedAt}
            />
          </CardContent>
        </Card>
      ) : lastStudiedKp ? (
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待复习</CardTitle>
            <Brain className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cardsDue > 0 || dueKpCount > 0 ? cardsDue + dueKpCount : "🎉"}
              {cardsTotal > 0 && <span className="text-sm font-normal text-muted-foreground"> / {cardsTotal}</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {cardsDue > 0 && dueKpCount > 0
                ? `${cardsDue} 张闪卡 · ${dueKpCount} 个知识点`
                : cardsDue > 0
                  ? `${cardsDue} 张闪卡待复习`
                  : dueKpCount > 0
                    ? `${dueKpCount} 个知识点待复习`
                    : cardsTotal > 0
                      ? `${masteredCount} 张已掌握`
                      : "暂无复习任务"}
            </p>
            <Link href="/review">
              <Button className="mt-3 w-full" size="sm">
                {cardsDue > 0 || dueKpCount > 0 ? "开始复习" : "复习中心"}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日复习</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayKpReviews > 0 ? todayKpReviews : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reviewStreak > 0 ? `🔥 ${reviewStreak} 天连续` : "今日未复习"}
            </p>
            <Link href="/review">
              <Button className="mt-3 w-full" size="sm" variant="outline">
                <Brain className="h-3.5 w-3.5 mr-1" />复习中心
              </Button>
            </Link>
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

      {/* Streak Calendar */}
      <StreakCalendar />

      {/* Daily Checklist + Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DailyChecklist />
        </div>
        <div className="flex flex-col gap-4">
          {/* Quick actions card */}
          <div className="rounded-xl border p-4">
            <h4 className="text-sm font-medium mb-3">快捷操作</h4>
            <div className="space-y-2">
              <Link href="/courses">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <BookOpen className="h-4 w-4" />浏览课程
                </Button>
              </Link>
              <Link href="/review">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Brain className="h-4 w-4" />复习中心
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <MessageSquare className="h-4 w-4" />AI 对话
                </Button>
              </Link>
              <Link href="/notes/new">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <BookOpen className="h-4 w-4" />写笔记
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueModules.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  你有 {overdueModules.length} 个逾期模块未完成
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {overdueModules.slice(0, 6).map((m) => {
                    const overdueDays = Math.ceil((now.getTime() - new Date(m.scheduledDate!).getTime()) / 86400000)
                    return (
                      <div key={m.id} className="flex items-center gap-1.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded-md">
                        <Link href={`/courses/${m.course.id}`}
                          className="hover:underline truncate max-w-[200px]"
                          title={`${m.course.title} > ${m.title}`}>
                          {m.course.icon} {m.title}
                        </Link>
                        <span className="font-semibold shrink-0">逾期{overdueDays}天</span>
                        <OverdueActions moduleId={m.id} />
                      </div>
                    )
                  })}
                  {overdueModules.length > 6 && (
                    <Link href="/schedule" className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
                      +{overdueModules.length - 6} 个
                    </Link>
                  )}
                </div>
              </div>
              <Link href="/schedule">
                <Button variant="outline" size="sm" className="shrink-0 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400">
                  <Clock className="h-3.5 w-3.5 mr-1" />查看排期
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
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

      {/* Weekly Report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            本周学习周报
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {startOfWeek.getMonth() + 1}/{startOfWeek.getDate()} - {endOfWeek.getMonth() + 1}/{endOfWeek.getDate() - 1}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Completed this week */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">本周已完成</span>
                <Badge className="bg-green-500 text-[10px]">{weeklyCompletedKps.length}</Badge>
              </div>
              {weeklyCompletedKps.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {weeklyCompletedKps.slice(0, 10).map((kp) => (
                    <div key={kp.id} className="flex items-center gap-2 text-xs">
                      <span>{kp.module.course.icon}</span>
                      <span className="text-muted-foreground truncate">{kp.title}</span>
                      <span className="text-muted-foreground/50 shrink-0">
                        {kp.completedAt ? new Date(kp.completedAt).toLocaleDateString("zh-CN", { weekday: "short" }) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">本周暂无完成记录，加油！</p>
              )}
            </div>
            {/* Overdue this week */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">逾期未完成</span>
                <Badge className="bg-red-500 text-[10px]">{overdueModules.length}</Badge>
              </div>
              {overdueModules.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {overdueModules.slice(0, 10).map((m) => {
                    const d = Math.ceil((now.getTime() - new Date(m.scheduledDate!).getTime()) / 86400000)
                    return (
                      <Link key={m.id} href={`/courses/${m.course.id}`}
                        className="flex items-center gap-2 text-xs hover:bg-muted rounded px-1 py-0.5 transition-colors">
                        <span>{m.course.icon}</span>
                        <span className="truncate flex-1">{m.title}</span>
                        <span className="text-red-500 font-medium shrink-0">逾期{d}天</span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">暂无逾期模块，继续保持！</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
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
