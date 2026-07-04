import { prisma } from "@/lib/db"
import { getContentPlain } from "./skills/content-levels"
import { guideExplanationPrompt } from "./skills/guide-explanation"

// ============================================================
// Context builder — optimized for LLM disk cache hit rate
//
// Static prefix first → hits DeepSeek disk cache (10% cost).
// Dynamic content second. Context levels:
//   "minimal"  — identity only (~50 tokens)    → structured gen
//   "standard" — identity + KP content          → evaluation
//   "full"     — identity + profile + course    → chat / coach
//                map + anchors + weak areas
// ============================================================

export type ContextLevel = "minimal" | "standard" | "full"

export interface AIContext {
  systemPrompt: string
  messages: { role: "user" | "assistant" | "system"; content: string }[]
}

// ---- Static prefix (NEVER changes → always hits disk cache) ---
const STATIC_IDENTITY = [
  `You are an AI learning assistant for MindForge (墨源).`,
  `Help the user learn through active recall and guided discovery.`,
  `Respond in Chinese unless the user writes in English.`,
].join("\n")

// ---- Public API ------------------------------------------------

interface BuildContextParams {
  userId: string
  topicNoteId?: string
  courseId?: string
  knowledgePointId?: string
  conversationHistory?: { role: string; content: string }[]
  /** Context depth — default "full" for backward compatibility */
  level?: ContextLevel
}

/**
 * Build system prompt + messages.
 *
 * Token cost by level (approximate):
 *   "minimal"  ~50 tokens   — structured gen (flashcards, quizzes, summaries)
 *   "standard" ~800 tokens  — evaluation (answer grading, recall compare)
 *   "full"     ~2000 tokens — conversation (AI chat, coach Q&A)
 */
export async function buildContext(params: BuildContextParams): Promise<AIContext> {
  const { userId, topicNoteId, courseId, knowledgePointId, conversationHistory, level = "full" } = params

  // L1: minimal — just static identity (for structured generation)
  if (level === "minimal") {
    return makeContext(STATIC_IDENTITY, conversationHistory)
  }

  // L3: full curriculum context — static prefix first for cache
  if (courseId && knowledgePointId && level === "full") {
    return buildCurriculumContext(userId, courseId, knowledgePointId, conversationHistory)
  }

  // L2: standard — identity + limited topic context
  const [profile, note, relatedNotes, weakAreas] = await Promise.all([
    level === "full" ? prisma.learningProfile.findUnique({ where: { userId } }) : null,
    topicNoteId ? prisma.page.findUnique({ where: { id: topicNoteId } }) : null,
    topicNoteId && level === "full" ? getRelatedNotes(topicNoteId) : [],
    level === "full"
      ? prisma.blindSpot.findMany({ where: { userId, isResolved: false }, orderBy: { severity: "desc" }, take: 5 })
      : [],
  ])

  const anchors = level === "full"
    ? await prisma.instructionAnchor.findMany({ where: { userId, isActive: true }, orderBy: { priority: "desc" } })
    : []

  const parts: string[] = [STATIC_IDENTITY]

  if (profile) {
    parts.push(`\n## Profile\n- Level: ${profile.knowledgeLevel}\n- Goals: ${profile.learningGoals}\n- Style: ${profile.preferredStyle}${profile.preferences ? `\n- Prefs: ${profile.preferences}` : ""}`)
  }
  if (anchors.length > 0) {
    parts.push(`\n## Rules\n${anchors.map((a) => `- [${a.category}] ${a.instruction}`).join("\n")}`)
  }
  if (note) {
    const truncated = note.contentPlain.slice(0, 2000)
    parts.push(`\n## Topic: ${note.title}\n${truncated}${truncated.length >= 2000 ? "\n...(truncated)" : ""}`)
  }
  if (relatedNotes.length > 0) {
    parts.push(`\n## Related\n${relatedNotes.map((n) => `- ${n.title}: ${n.excerpt ?? ""}`).join("\n")}`)
  }
  if (weakAreas.length > 0) {
    parts.push(`\n## Weak Areas\n${weakAreas.map((w) => `- ${w.topic} (${Math.round(w.severity * 100)}%)`).join(", ")}`)
  }

  return makeContext(parts.join("\n"), conversationHistory)
}

// ---- Helpers ---------------------------------------------------

function makeContext(
  systemPrompt: string,
  history?: { role: string; content: string }[]
): AIContext {
  return {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      ...(history?.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) ?? []),
    ],
  }
}

async function getRelatedNotes(noteId: string, maxNotes = 5) {
  const links = await prisma.noteLink.findMany({
    where: { OR: [{ sourcePageId: noteId }, { targetPageId: noteId }] },
    include: {
      sourcePage: { select: { id: true, title: true, excerpt: true } },
      targetPage: { select: { id: true, title: true, excerpt: true } },
    },
    take: maxNotes,
  })
  return links.map((l) => {
    const r = l.sourcePageId === noteId ? l.targetPage : l.sourcePage
    return { id: r.id, title: r.title, excerpt: r.excerpt }
  })
}

// ---- Full curriculum context (L3 — chat/coach) -----------------
// Static prefix + profile + anchors → cache hit (~90% reduction)
// Dynamic: course map, module KPs, KP content, weak areas

async function buildCurriculumContext(
  userId: string,
  courseId: string,
  knowledgePointId: string,
  conversationHistory?: { role: string; content: string }[]
): Promise<AIContext> {
  const [course, modules, kp, profile, anchors, weakAreas] = await Promise.all([
    prisma.course.findFirst({ where: { id: courseId, userId } }),
    prisma.module.findMany({
      where: { courseId }, orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, parentModuleId: true, status: true, sortOrder: true },
    }),
    prisma.knowledgePoint.findUnique({
      where: { id: knowledgePointId },
      include: { module: { select: { id: true, title: true } } },
    }),
    prisma.learningProfile.findUnique({ where: { userId } }),
    prisma.instructionAnchor.findMany({ where: { userId, isActive: true }, orderBy: { priority: "desc" } }),
    prisma.blindSpot.findMany({ where: { userId, isResolved: false }, orderBy: { severity: "desc" }, take: 5 }),
  ])

  if (!course || !kp) return makeContext(STATIC_IDENTITY, conversationHistory)

  const now = new Date()
  const daysSinceReviewed = kp.lastReviewedAt
    ? Math.round((now.getTime() - new Date(kp.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isReviewDue = kp.sm2NextReview && new Date(kp.sm2NextReview) <= now
  const reviewDueDays = kp.sm2NextReview
    ? Math.round((new Date(kp.sm2NextReview).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  let masteryStatus = "首次学习"
  if (kp.mastery >= 4) {
    if (isReviewDue) {
      masteryStatus = `已掌握，但需复习（过期${Math.abs(reviewDueDays || 0)}天）`
    } else if (daysSinceReviewed !== null) {
      masteryStatus = `已掌握，上次复习${daysSinceReviewed}天前`
    } else {
      masteryStatus = "已掌握"
    }
  } else if (kp.mastery > 0) {
    if (isReviewDue) {
      masteryStatus = `学习中，需复习（过期${Math.abs(reviewDueDays || 0)}天）`
    } else {
      masteryStatus = `学习中（掌握度${kp.mastery}/5）`
    }
  }

  // === CACHE-FRIENDLY PREFIX (static identity + profile + anchors) ===
  const parts: string[] = [STATIC_IDENTITY]

  if (profile) {
    parts.push(`\n## Profile\n- Level: ${profile.knowledgeLevel}\n- Goals: ${profile.learningGoals}\n- Style: ${profile.preferredStyle}${profile.preferences ? `\n- Prefs: ${profile.preferences}` : ""}`)
  }
  if (anchors.length > 0) {
    parts.push(`\n## Rules\n${anchors.map((a) => `- [${a.category}] ${a.instruction}`).join("\n")}`)
  }

  // === DYNAMIC CONTENT (changes per call — full price) ===
  const total = modules.filter((m) => !m.parentModuleId).length
  const done = modules.filter((m) => !m.parentModuleId && m.status === "completed").length
  const versionTag = course.version ? ` [v${course.version}]` : ""
  parts.push(`\n## Course: ${course.title}${versionTag} (${done}/${total} done) | Module: ${kp.module.title}`)
  parts.push(`\n## Learning State: ${masteryStatus} | Mastery: ${kp.mastery}/5 | Status: ${kp.status}`)
  if (course.version) {
    parts.push(`**VERSION LOCK**: 本课程严格限定为 ${course.title} ${course.version} 版本。你回答的所有内容、API、概念、配置都必须基于 ${course.version} 版本。绝对禁止提及或混入其他版本的特性、变更或废弃内容。如果用户问到其他版本的内容，礼貌地告知用户本课程只覆盖 ${course.version} 版本。`)
  }

  // Compact module map
  const top = modules.filter((m) => !m.parentModuleId)
  parts.push(`Map: ${top.map((m) => (m.id === kp.moduleId ? "★" : m.status === "completed" ? "✓" : "○") + m.title).join(" | ")}`)

  // Module KPs
  const cur = top.find((m) => m.id === kp.moduleId)
  if (cur) {
    const kps = await prisma.knowledgePoint.findMany({
      where: { moduleId: cur.id }, orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, mastery: true },
    })
    parts.push(`\nKPs: ${kps.map((p) => (p.id === knowledgePointId ? "→" : p.mastery >= 4 ? "✓" : "○") + p.title + `(${p.mastery}/5)`).join(" · ")}`)
  }

  // KP content (trimmed)
  if (kp.content) {
    const plain = getContentPlain(kp.content)
    parts.push(`\n## ${kp.title}\n${plain.slice(0, 2500)}${plain.length >= 2500 ? "\n...(truncated)" : ""}`)
  }

  // Weak areas
  if (weakAreas.length > 0) {
    parts.push(`\n## Weak: ${weakAreas.map((w) => w.topic + `(${Math.round(w.severity * 100)}%)`).join(", ")}`)
  }

  // Teaching methodology (semi-static, rarely changes)
  parts.push(guideExplanationPrompt(kp.title, cur?.title ?? kp.module.title))

  return makeContext(parts.join("\n"), conversationHistory)
}
