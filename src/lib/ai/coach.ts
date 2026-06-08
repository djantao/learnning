// AI Coach — 对话式学习教练
// 核心逻辑：生成问题 + 评价回答 + 追问

import { chatCompletion } from "./client"
import { prisma } from "@/lib/db"
import { getContentPlain } from "@/lib/ai/skills/content-levels"

// ============================================================
// 类型定义
// ============================================================

export interface CoachRound {
  q: string       // coach 的问题
  a?: string      // 用户的回答
  feedback?: string // coach 的评价
  reference?: string // coach 给出的参考答案
  followUp?: string  // coach 的追问
  at: string      // ISO timestamp
}

export interface CoachState {
  sessionId: string
  courseTitle: string
  kpTitle: string
  courseId?: string
  kpId?: string
  difficulty: string
  rounds: CoachRound[]
  status: string
}

// ============================================================
// 获取用户当前学习进度
// ============================================================

async function getUserProgress(userId: string, targetKpId?: string) {
  // 如果指定了 kpId，直接使用它
  if (targetKpId) {
    const kp = await prisma.knowledgePoint.findUnique({
      where: { id: targetKpId },
      include: { module: { include: { course: true } } },
    })
    if (!kp || kp.module.course.userId !== userId) return null

    return {
      courseId: kp.module.course.id,
      courseTitle: kp.module.course.title,
      moduleTitle: kp.module.title,
      kpId: kp.id,
      kpTitle: kp.title,
      kpContent: kp.content,
      difficulty: inferDifficulty(kp.mastery),
      mastery: kp.mastery,
    }
  }

  // 1. 找用户最近在学的课程
  const activeCourse = await prisma.course.findFirst({
    where: { userId, isActive: true },
    orderBy: { updatedAt: "desc" },
    include: {
      modules: {
        include: {
          knowledgePoints: {
            where: { status: { not: "mastered" } },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!activeCourse) return null

  // 2. 找第一个未完成的 KP
  let targetKp: { id: string; title: string; content: string; status: string; mastery: number } | null = null
  let targetModule: { title: string } | null = null

  for (const mod of activeCourse.modules) {
    if (mod.knowledgePoints.length > 0) {
      targetKp = mod.knowledgePoints[0]
      targetModule = mod
      break
    }
  }

  if (!targetKp) return null

  // 3. 判断当前应该用什么难度
  const difficulty = inferDifficulty(targetKp.mastery)

  return {
    courseId: activeCourse.id,
    courseTitle: activeCourse.title,
    moduleTitle: targetModule!.title,
    kpId: targetKp.id,
    kpTitle: targetKp.title,
    kpContent: targetKp.content,
    difficulty,
    mastery: targetKp.mastery,
  }
}

function inferDifficulty(mastery: number): string {
  if (mastery <= 1) return "入门"
  if (mastery <= 3) return "进阶"
  return "高阶"
}

// ============================================================
// 生成教练问题
// ============================================================

interface GenerateQuestionInput {
  courseTitle: string
  moduleTitle: string
  kpTitle: string
  kpContent: string
  difficulty: string
  previousRounds?: CoachRound[]
}

export async function generateCoachQuestion(input: GenerateQuestionInput): Promise<{
  question: string
  referenceAnswer: string
}> {
  const { courseTitle, moduleTitle, kpTitle, kpContent, difficulty, previousRounds } = input

  const contentPreview = kpContent
    ? getContentPlain(kpContent, difficulty).slice(0, 1500)
    : "暂无内容缓存"

  // 构建对话历史
  let historyBlock = ""
  if (previousRounds && previousRounds.length > 0) {
    historyBlock = `\n【之前的对话】\n${
      previousRounds.slice(-2).map((r, i) =>
        `第${i+1}轮：\n教练问：${r.q}\n学员答：${r.a || "(未回答)"}\n教练评：${r.feedback || ""}`
      ).join("\n\n")
    }\n`
  }

  const prompt = `你是学习教练。你的学员正在学「${courseTitle}」→「${moduleTitle}」→「${kpTitle}」，当前在「${difficulty}」层级。

${historyBlock}
【知识点内容供参考】
${contentPreview || "暂无"}

【教练任务】
生成 1 个场景化问题，让学员主动思考。要求：
${difficulty === "入门" ? `
- 用场景/类比引发思考，不要直接考定义
- 问题要让学员"用自己的话说"或"举生活例子"
- 1-2 句话就够了，不要太长
- 给出标准参考答案（2-3 句）
` : difficulty === "进阶" ? `
- 提出一个真实场景中的决策问题（"你会选方案A还是方案B？为什么？"）
- 问题要有两难感，没有显而易见的答案
- 2-3 句话说明场景
- 给出参考判断标准（不直接说答案，给分析维度）
` : `
- 提出一个深层机制/设计哲学的问题（"为什么这样设计？换一种会怎样？"）
- 考察对底层因果的理解，不是记忆
- 2-3 句话
- 给出参考分析方向（1-2 个关键洞察点）
`}

输出 JSON（不要 markdown 代码块）：
{"question":"问题文本","reference":"参考答案/分析方向"}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      maxTokens: 600,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        question: `在「${kpTitle}」的学习中，你已经了解了基本概念。能用自己的话讲一下它是什么、解决什么问题吗？`,
        referenceAnswer: `${kpTitle} 的核心是建立了一套解决该领域问题的思维框架，关键点是理解其设计动机和适用边界。`,
      }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      question: parsed.question || "让我们聊聊你最近学的内容",
      referenceAnswer: parsed.reference || "思考一下这个问题的本质",
    }
  } catch (error) {
    console.error("Coach question generation error:", error)
    return {
      question: `你最近在学「${kpTitle}」，它对你之前理解的概念有新的启发吗？`,
      referenceAnswer: "试着把新知识和已有的知识连接起来，找到它们之间的关系。",
    }
  }
}

// ============================================================
// 评价用户回答
// ============================================================

interface EvaluateAnswerInput {
  question: string
  userAnswer: string
  referenceAnswer: string
  difficulty: string
  kpTitle: string
  previousRounds?: CoachRound[]
}

export async function evaluateCoachAnswer(input: EvaluateAnswerInput): Promise<{
  feedback: string
  followUp: string
  score: number // 1-5
}> {
  const { question, userAnswer, referenceAnswer, difficulty, kpTitle } = input

  const prompt = `你是学习教练。你之前问学员一个问题，现在学员回答了。请评价。

【你问的问题】
${question}

【参考答案方向】
${referenceAnswer}

【学员的回答（可能简短、可能有误、可能精彩）】
${userAnswer}

【当前学习层级】${difficulty}

【评价要求】
1. 先给鼓励（找到回答中的亮点，哪怕很小）
2. 然后指出差距或可深化之处（友好但不敷衍，像真正的教练）
3. 给出修正/补充（把参考答案方向具体化，结合学员的回答对比）
4. 追问一句，引导学员进一步思考或实践

评价风格：简洁直接，不要长篇大论。教练说话的对象是成年人。

评分标准：
- 5分：回答准确、有自己理解、能举一反三
- 4分：基本正确，但可以更深入
- 3分：方向对，但没讲清楚或漏了关键点
- 2分：部分有道理，但有明显误解
- 1分：完全跑题或没理解问题

输出 JSON（不要 markdown 代码块）：
{"feedback":"你的回答中...|但可以补充的是...","followUp":"既然你提到了X，那如果Y场景呢？","score":3}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      maxTokens: 500,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        feedback: "谢谢你的回答！能看出你在认真思考这个问题。",
        followUp: "下次学习时，试着从另一个角度重新看这个问题。",
        score: 3,
      }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      feedback: parsed.feedback || "很好，你的回答让我看到了你的思考过程。",
      followUp: parsed.followUp || "下次我们再深入聊聊这个话题。",
      score: typeof parsed.score === "number" ? Math.max(1, Math.min(5, parsed.score)) : 3,
    }
  } catch (error) {
    console.error("Coach evaluation error:", error)
    return {
      feedback: "收到！你的回答很有价值，这本身就是学习的一部分。",
      followUp: "我们下次继续深入这个话题。",
      score: 3,
    }
  }
}

// ============================================================
// 会话管理
// ============================================================

export async function getOrCreateSession(userId: string, targetKpId?: string): Promise<CoachState | null> {
  // 找活跃 session
  let existingSession = null
  if (!targetKpId) {
    existingSession = await prisma.coachSession.findFirst({
      where: { userId, status: "active" },
      include: { course: { select: { title: true } }, knowledgePoint: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
    })
  }

  // 如果有活跃 session 且没指定 kpId，直接返回
  if (existingSession) {
    return {
      sessionId: existingSession.id,
      courseTitle: existingSession.course?.title ?? "未知课程",
      kpTitle: existingSession.knowledgePoint?.title ?? "未知知识点",
      courseId: existingSession.courseId ?? undefined,
      kpId: existingSession.knowledgePointId ?? undefined,
      difficulty: existingSession.difficulty,
      rounds: JSON.parse(existingSession.roundsJson) as CoachRound[],
      status: existingSession.status,
    }
  }

  // 指定了 kpId — 把旧活跃 session 逐个标记完成
  if (targetKpId) {
    const oldSessions = await prisma.coachSession.findMany({
      where: { userId, status: "active" },
      select: { id: true },
    })
    for (const old of oldSessions) {
      await prisma.coachSession.update({
        where: { id: old.id },
        data: { status: "completed" },
      })
    }
  }

  // 创建新 session
  const progress = await getUserProgress(userId, targetKpId)
  if (!progress) return null

  let session = await prisma.coachSession.create({
    data: { userId, courseId: progress.courseId, knowledgePointId: progress.kpId, difficulty: progress.difficulty },
  })

  session = await prisma.coachSession.findUnique({
    where: { id: session.id },
    include: { course: { select: { title: true } }, knowledgePoint: { select: { title: true } } },
  })
  if (!session) return null

  return {
    sessionId: session.id,
    courseTitle: session.course?.title ?? progress.courseTitle,
    kpTitle: session.knowledgePoint?.title ?? progress.kpTitle,
    courseId: session.courseId ?? undefined,
    kpId: session.knowledgePointId ?? undefined,
    difficulty: session.difficulty,
    rounds: [],
    status: session.status,
  }
}

export async function appendRound(
  sessionId: string,
  round: CoachRound
): Promise<void> {
  const session = await prisma.coachSession.findUnique({ where: { id: sessionId } })
  if (!session) return

  const rounds: CoachRound[] = JSON.parse(session.roundsJson)
  rounds.push(round)

  await prisma.coachSession.update({
    where: { id: sessionId },
    data: {
      roundsJson: JSON.stringify(rounds),
      lastPushAt: new Date(),
      pushCount: { increment: 1 },
    },
  })
}

export async function updateSessionProgress(
  sessionId: string,
  updates: { difficulty?: string; knowledgePointId?: string; status?: string }
): Promise<void> {
  await prisma.coachSession.update({
    where: { id: sessionId },
    data: updates,
  })
}

// ============================================================
// 检查今天是否需要推送
// ============================================================

export async function shouldPushToday(userId: string): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 检查今天的 DailyActivity
  const activity = await prisma.dailyActivity.findFirst({
    where: { userId, date: today },
  })

  // 如果今天已经有学习活动（至少记录了 KP 完成），不推送
  if (activity && activity.kpsCompleted > 0) return false

  // 检查今天是否已经推送过
  const session = await prisma.coachSession.findFirst({
    where: {
      userId,
      status: "active",
      lastPushAt: { gte: today },
    },
  })

  return !session
}
