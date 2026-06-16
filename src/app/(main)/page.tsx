import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Brain, BookOpen, MessageSquare, TrendingUp, Target, AlertTriangle, Star, GraduationCap, Clock, CheckCircle2, AlertCircle, Flame, Sparkles } from "lucide-react"
import { getTodayModules, rebalanceSchedule } from "@/lib/schedule"
import { ResumeButton } from "@/components/courses/resume-button"
import { StreakCalendar } from "@/components/dashboard/streak-calendar"
import { DailyChecklist } from "@/components/dashboard/daily-checklist"
import { OverdueActions } from "@/components/dashboard/overdue-actions"
import { KnowledgePulse } from "@/components/dashboard/knowledge-pulse"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = session.user.id
  const userName = session.user.name ?? session.user.email ?? "同学"

  rebalanceSchedule(userId).catch(() => {})

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const [
    dueCardsCount, totalCardsCount, masteredCount,
    recentNotes, recentConversations, goals, blindSpots,
    todayActivity, activityDates, lastStudiedKp, todaySchedule,
    overdueModules, weeklyCompletedKps, resumeUser,
    todayKpReviews, reviewLogDates, dueKpCount,
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
    prisma.knowledgePoint.findFirst({ where: { status: "in_progress", module: { course: { userId } } }, orderBy: { updatedAt: "desc" }, include: { module: { include: { course: { select: { id: true, title: true } } } } } }),
    getTodayModules(userId),
    prisma.module.findMany({ where: { course: { userId }, scheduledDate: { lt: now }, status: { not: "completed" } }, include: { course: { select: { id: true, title: true, icon: true, color: true } } }, orderBy: { scheduledDate: "asc" } }),
    prisma.knowledgePoint.findMany({ where: { module: { course: { userId } }, completedAt: { gte: startOfWeek, lt: endOfWeek } }, include: { module: { include: { course: { select: { id: true, title: true, icon: true, color: true } } } } }, orderBy: { completedAt: "desc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { resumeCourseId: true, resumeKpId: true, resumeUpdatedAt: true } }),
    prisma.kpReviewLog.count({ where: { userId, createdAt: { gte: new Date(new Date().toDateString()) } } }),
    prisma.kpReviewLog.findMany({ where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 90 }),
    prisma.knowledgePoint.count({ where: { module: { course: { userId } }, mastery: { gte: 4 }, sm2NextReview: { lte: new Date() } } }),
  ])

  let resumePosition: { courseId: string; courseTitle: string; courseIcon: string; courseColor: string; kpId: string; kpTitle: string; moduleId: string; updatedAt: string } | null = null
  if (resumeUser?.resumeCourseId && resumeUser?.resumeKpId) {
    const [resumeCourse, resumeKp] = await Promise.all([
      prisma.course.findUnique({ where: { id: resumeUser.resumeCourseId }, select: { id: true, title: true, icon: true, color: true } }),
      prisma.knowledgePoint.findUnique({ where: { id: resumeUser.resumeKpId }, select: { id: true, title: true, moduleId: true } }),
    ])
    if (resumeCourse && resumeKp) {
      resumePosition = { courseId: resumeCourse.id, courseTitle: resumeCourse.title, courseIcon: resumeCourse.icon, courseColor: resumeCourse.color, kpId: resumeKp.id, kpTitle: resumeKp.title, moduleId: resumeKp.moduleId, updatedAt: resumeUser.resumeUpdatedAt?.toISOString() ?? "" }
    }
  }

  const cardsDue = dueCardsCount
  const cardsTotal = totalCardsCount

  let streak = 0
  const today = new Date(new Date().toDateString())
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const dateStr = checkDate.toDateString()
    if (activityDates.some((a) => new Date(a.date).toDateString() === dateStr)) { streak++ }
    else if (i === 0) { continue }
    else { break }
  }

  let reviewStreak = 0
  const reviewDateSet = new Set(reviewLogDates.map((l) => new Date(l.createdAt).toDateString()))
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    if (reviewDateSet.has(checkDate.toDateString())) { reviewStreak++ }
    else if (i === 0) { continue }
    else { break }
  }

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
    <div className="space-y-6 sm:space-y-8 pb-8">

      {/* ================================================================
          HERO ROW — Asymmetric: 2/3 Continue + 1/3 KnowledgePulse
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Hero Card: Continue Learning */}
        <div className="lg:col-span-2">
          {resumePosition ? (
            <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-[var(--copper)]/5 dark:from-primary/10 dark:via-primary/[0.04] dark:to-[var(--copper)]/8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--copper)]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
              <CardContent className="relative py-5 sm:py-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3 w-3" />
                    继续学习
                  </div>
                  {streak > 0 && (
                    <span className="text-xs text-muted-foreground">
                      🔥 {streak} 天活跃 · {reviewStreak} 天复习
                    </span>
                  )}
                </div>
                <p className="text-lg sm:text-xl font-bold mb-4">欢迎回来，{userName}</p>
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
                {/* Mini stats inside hero */}
                <div className="flex flex-wrap gap-3 sm:gap-4 mt-5 pt-4 border-t border-border/50">
                  {[
                    { label: "待复习", value: cardsDue + dueKpCount, suffix: cardsTotal > 0 ? ` / ${cardsTotal}` : "", icon: Brain, color: "text-amber-500", href: "/review" },
                    { label: "今日复习", value: todayKpReviews || "--", suffix: "", icon: Flame, color: "text-orange-500", href: "/review" },
                    { label: "笔记", value: todayActivity?.notesCreated ?? 0, suffix: " 今日", icon: BookOpen, color: "text-blue-500", href: "/notes/new" },
                    { label: "AI 对话", value: todayActivity?.aiConversations ?? 0, suffix: " 今日", icon: MessageSquare, color: "text-purple-500", href: "/chat" },
                    { label: "学习时长", value: todayActivity?.studyMinutes ?? 0, suffix: " 分钟", icon: TrendingUp, color: "text-green-500", href: "#" },
                  ].map((stat) => (
                    <Link key={stat.label} href={stat.href}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted/60 transition-colors group">
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      <div>
                        <div className="text-lg font-bold tabular-nums leading-none">
                          {stat.value}{stat.suffix && <span className="text-xs font-normal text-muted-foreground">{stat.suffix}</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : lastStudiedKp ? (
            <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/8 to-transparent rounded-full blur-3xl pointer-events-none" />
              <CardContent className="relative flex items-center justify-between py-6">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">继续学习</p>
                    <p className="font-bold text-lg truncate mt-0.5">{lastStudiedKp.module.course.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{lastStudiedKp.module.title} / {lastStudiedKp.title}</p>
                    <div className="flex items-center gap-0.5 mt-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= ((lastStudiedKp as any).mastery ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
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
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <GraduationCap className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-semibold text-lg">开始你的学习之旅</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">选择一门课程，开启 MindForge 学习体验</p>
                <Link href="/courses"><Button>浏览课程</Button></Link>
              </CardContent>
            </Card>
          )}

          {/* Review reminder banner */}
          {(dueCardsCount > 0 || dueKpCount > 0) && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0">
                <Brain className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {dueCardsCount > 0 && dueKpCount > 0 ? `${dueCardsCount} 张闪卡 + ${dueKpCount} 个知识点待复习`
                    : dueCardsCount > 0 ? `${dueCardsCount} 张闪卡等待复习`
                    : `${dueKpCount} 个知识点等待复习`}
                </p>
                <p className="text-xs text-muted-foreground">间隔重复是长期记忆的关键</p>
              </div>
              <Link href="/review"><Button size="sm">开始复习</Button></Link>
            </div>
          )}
        </div>

        {/* Knowledge Pulse — signature element */}
        <div className="lg:col-span-1">
          <KnowledgePulse
            studyMinutes={todayActivity?.studyMinutes ?? 0}
            notesCreated={todayActivity?.notesCreated ?? 0}
            aiConversations={todayActivity?.aiConversations ?? 0}
            streak={streak}
            kpReviewed={todayKpReviews}
          />
        </div>
      </div>

      {/* ================================================================
          SECOND ROW: Calendar (2/3) + Daily Checklist (1/3)
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2"><StreakCalendar /></div>
        <div className="lg:col-span-1"><DailyChecklist /></div>
      </div>

      {/* Overdue Alert */}
      {overdueModules.length > 0 && (
        <Card className="border-red-200 dark:border-red-800/50 bg-red-50/80 dark:bg-red-950/20">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40 shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">{overdueModules.length} 个逾期模块</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {overdueModules.slice(0, 6).map((m) => {
                      const overdueDays = Math.ceil((now.getTime() - new Date(m.scheduledDate!).getTime()) / 86400000)
                      return (
                        <Link key={m.id} href={`/courses/${m.course.id}`}
                          className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                          <span>{m.course.icon}</span>
                          <span className="truncate max-w-[160px]">{m.title}</span>
                          <span className="font-semibold shrink-0">· 逾期{overdueDays}天</span>
                        </Link>
                      )
                    })}
                    {overdueModules.length > 6 && <span className="text-xs text-muted-foreground px-2 py-1">+{overdueModules.length - 6} 个</span>}
                  </div>
                </div>
              </div>
              <Link href="/schedule" className="shrink-0">
                <Button variant="outline" size="sm" className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400">
                  <Clock className="h-3.5 w-3.5 mr-1" />查看排期
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals + Blind Spots */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
              </div>
              学习项目
            </CardTitle>
            <Link href="/goals"><Button variant="ghost" size="sm">管理</Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.length > 0 ? (
              <>
                <div className="flex gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-1">
                  <span>{goals.length} 个项目</span><span>·</span>
                  <span>{goals.reduce((s: number, g: any) => s + (g.course ? 1 : 0) + g.childGoals.filter((c: any) => c.course).length, 0)} 门课程</span><span>·</span>
                  <span>本周 {todayActivity?.studyMinutes ?? 0} 分钟</span>
                </div>
                {goals.map((goal) => {
                  const courseCount = (goal.course ? 1 : 0) + goal.childGoals.filter((c: any) => c.course).length
                  const courseNames: string[] = []
                  if (goal.course) courseNames.push(goal.course.title)
                  for (const child of (goal.childGoals || [])) { if (child.course) courseNames.push(child.course.title) }
                  return (
                    <Link key={goal.id} href={`/goals/${goal.id}`} className="block rounded-xl p-3.5 hover:bg-muted/60 transition-colors border border-transparent hover:border-border">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-sm truncate">{goal.title}</p>
                          {courseCount > 0 && <Badge variant="secondary" className="text-[10px] shrink-0">{courseCount} 门课</Badge>}
                        </div>
                        <span className="text-sm font-bold tabular-nums shrink-0 ml-2">{Math.round(goal.progressPct)}%</span>
                      </div>
                      <Progress value={goal.progressPct} className="h-1.5 mb-2" />
                      {courseNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          {courseNames.slice(0, 3).map((name, i) => <span key={i} className="bg-muted px-2 py-0.5 rounded-full">{name}</span>)}
                          {courseNames.length > 3 && <span>+{courseNames.length - 3}</span>}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </>
            ) : (
              <div className="text-center py-8">
                <Target className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">还没有学习目标</p>
                <Link href="/goals"><Button variant="outline" size="sm" className="mt-3">创建目标</Button></Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
              知识盲区
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blindSpots.length > 0 ? blindSpots.map((spot) => (
              <div key={spot.id} className="flex items-center justify-between rounded-xl border p-3.5 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{spot.topic}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{spot.description || spot.suggestion}</p>
                  <Progress value={spot.severity * 100} className="mt-2 h-1 w-20" />
                </div>
                <Badge variant={spot.severity > 0.6 ? "destructive" : "secondary"} className="text-xs shrink-0 ml-3">{Math.round(spot.severity * 100)}%</Badge>
              </div>
            )) : (
              <div className="text-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 dark:bg-green-950/20 mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                </div>
                <p className="text-sm font-medium">暂无知识盲区</p>
                <p className="text-xs text-muted-foreground mt-1">积累更多复习记录后，AI 将帮你分析薄弱点</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            本周学习周报
          </CardTitle>
          <Badge variant="outline" className="text-xs font-normal">
            {startOfWeek.getMonth() + 1}/{startOfWeek.getDate()} — {endOfWeek.getMonth() + 1}/{endOfWeek.getDate() - 1}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold">本周已完成</span>
                <Badge className="bg-green-500 text-[10px]">{weeklyCompletedKps.length}</Badge>
              </div>
              {weeklyCompletedKps.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {weeklyCompletedKps.slice(0, 10).map((kp) => (
                    <div key={kp.id} className="flex items-center gap-2 text-xs py-1">
                      <span>{kp.module.course.icon}</span>
                      <span className="text-muted-foreground truncate flex-1">{kp.title}</span>
                      <span className="text-muted-foreground/50 shrink-0">{kp.completedAt ? new Date(kp.completedAt).toLocaleDateString("zh-CN", { weekday: "short" }) : ""}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground py-4 text-center">本周暂无完成记录，加油！</p>}
            </div>
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold">逾期未完成</span>
                <Badge className="bg-red-500 text-[10px]">{overdueModules.length}</Badge>
              </div>
              {overdueModules.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {overdueModules.slice(0, 10).map((m) => {
                    const d = Math.ceil((now.getTime() - new Date(m.scheduledDate!).getTime()) / 86400000)
                    return (
                      <Link key={m.id} href={`/courses/${m.course.id}`} className="flex items-center gap-2 text-xs hover:bg-muted rounded-lg px-2 py-1.5 transition-colors">
                        <span>{m.course.icon}</span>
                        <span className="truncate flex-1">{m.title}</span>
                        <span className="text-red-500 font-medium shrink-0">逾期{d}天</span>
                      </Link>
                    )
                  })}
                </div>
              ) : <p className="text-xs text-muted-foreground py-4 text-center">暂无逾期模块，继续保持！</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <BookOpen className="h-4 w-4 text-blue-500" />
              </div>
              最近笔记
            </CardTitle>
            <Link href="/notebooks"><Button variant="ghost" size="sm">全部</Button></Link>
          </CardHeader>
          <CardContent>
            {recentNotes.length > 0 ? (
              <div className="space-y-1">
                {recentNotes.map((note) => (
                  <Link key={note.id} href={`/notes/${note.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{note.title}</p>
                      {note.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {note.tags.map((pt) => <Badge key={pt.tag.id} variant="secondary" className="text-[10px]">{pt.tag.name}</Badge>)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-3">{timeAgo(note.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">还没有笔记</p>
                <Link href="/notes/new"><Button variant="outline" size="sm" className="mt-3">写第一篇笔记</Button></Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <MessageSquare className="h-4 w-4 text-purple-500" />
              </div>
              最近 AI 对话
            </CardTitle>
            <Link href="/chat"><Button variant="ghost" size="sm">新对话</Button></Link>
          </CardHeader>
          <CardContent>
            {recentConversations.length > 0 ? (
              <div className="space-y-1">
                {recentConversations.map((conv) => (
                  <Link key={conv.id} href={`/chat`} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{conv.title || "无标题"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{conv.messageCount} 条消息</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-3">{timeAgo(conv.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">还没有 AI 对话</p>
                <Link href="/chat"><Button variant="outline" size="sm" className="mt-3">开始与 AI 对话</Button></Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
