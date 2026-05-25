import { prisma } from "@/lib/db"
import { getContentPlain } from "./skills/content-levels"
import { guideExplanationPrompt } from "./skills/guide-explanation"

export interface AIContext {
  systemPrompt: string
  messages: { role: "user" | "assistant" | "system"; content: string }[]
}

interface BuildContextParams {
  userId: string
  topicNoteId?: string
  courseId?: string
  knowledgePointId?: string
  conversationHistory?: { role: string; content: string }[]
}

export async function buildContext(params: BuildContextParams): Promise<AIContext> {
  const { userId, topicNoteId, courseId, knowledgePointId, conversationHistory } = params

  if (courseId && knowledgePointId) {
    return buildCurriculumContext(userId, courseId, knowledgePointId, conversationHistory)
  }

  const [profile, anchors, note, relatedNotes, weakAreas] = await Promise.all([
    prisma.learningProfile.findUnique({ where: { userId } }),
    prisma.instructionAnchor.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: "desc" },
    }),
    topicNoteId
      ? prisma.page.findUnique({ where: { id: topicNoteId } })
      : null,
    topicNoteId ? getRelatedNotes(topicNoteId) : [],
    prisma.blindSpot.findMany({
      where: { userId, isResolved: false },
      orderBy: { severity: "desc" },
      take: 5,
    }),
  ])

  const parts: string[] = []

  // Core identity
  parts.push(`You are an AI learning assistant. Your goal is to help the user learn effectively.`)

  // Learning profile (never forget)
  if (profile) {
    parts.push(`\n## User Learning Profile (ALWAYS keep this in mind)
- Knowledge Level: ${profile.knowledgeLevel}
- Learning Goals: ${profile.learningGoals}
- Preferred Style: ${profile.preferredStyle}
${profile.preferences ? `- Preferences: ${profile.preferences}` : ""}`)
  }

  // Instruction anchors (permanent instructions)
  if (anchors.length > 0) {
    parts.push(`\n## Permanent Instructions (NEVER forget these - they are the user's hard rules)
${anchors.map((a) => `- [${a.category}] ${a.instruction}`).join("\n")}`)
  }

  // Current topic context
  if (note) {
    const truncated = note.contentPlain.slice(0, 2000)
    parts.push(`\n## Current Topic: ${note.title}
Content excerpt:
${truncated}${truncated.length >= 2000 ? "...(truncated)" : ""}`)
  }

  // Related notes
  if (relatedNotes.length > 0) {
    parts.push(`\n## Related Notes (user may refer to these concepts)
${relatedNotes.map((n) => `- ${n.title}: ${n.excerpt ?? ""}`).join("\n")}`)
  }

  // Weak areas
  if (weakAreas.length > 0) {
    parts.push(`\n## User's Weak Areas (pay special attention to these)
${weakAreas.map((w) => `- ${w.topic} (severity: ${Math.round(w.severity * 100)}%): ${w.description}`).join("\n")}
Help the user strengthen these areas when relevant.`)
  }

  const systemPrompt = parts.join("\n")

  const messages: { role: "user" | "assistant" | "system"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? []),
  ]

  return { systemPrompt, messages }
}

async function getRelatedNotes(noteId: string, maxDepth = 1, maxNotes = 5) {
  const links = await prisma.noteLink.findMany({
    where: {
      OR: [{ sourcePageId: noteId }, { targetPageId: noteId }],
    },
    include: {
      sourcePage: { select: { id: true, title: true, excerpt: true } },
      targetPage: { select: { id: true, title: true, excerpt: true } },
    },
    take: maxNotes,
  })

  return links.map((l) => {
    const related = l.sourcePageId === noteId ? l.targetPage : l.sourcePage
    return { id: related.id, title: related.title, excerpt: related.excerpt }
  })
}

async function buildCurriculumContext(
  userId: string,
  courseId: string,
  knowledgePointId: string,
  conversationHistory?: { role: string; content: string }[]
): Promise<AIContext> {
  const [course, modules, kp, profile, anchors, weakAreas] = await Promise.all([
    prisma.course.findFirst({ where: { id: courseId, userId } }),
    prisma.module.findMany({
      where: { courseId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, parentModuleId: true, status: true, progressPct: true, sortOrder: true },
    }),
    prisma.knowledgePoint.findUnique({
      where: { id: knowledgePointId },
      include: { module: { select: { id: true, title: true } } },
    }),
    prisma.learningProfile.findUnique({ where: { userId } }),
    prisma.instructionAnchor.findMany({ where: { userId, isActive: true }, orderBy: { priority: "desc" } }),
    prisma.blindSpot.findMany({ where: { userId, isResolved: false }, orderBy: { severity: "desc" }, take: 5 }),
  ])

  if (!course || !kp) {
    return { systemPrompt: "You are a helpful assistant.", messages: [] }
  }

  const parts: string[] = []

  // Layer 1: Course overview
  const totalModules = modules.filter((m) => !m.parentModuleId).length
  const completedModules = modules.filter((m) => !m.parentModuleId && m.status === "completed").length
  const currentModuleTitle = kp.module.title

  parts.push(`You are an AI learning coach. You are helping the user learn "${course.title}".`)
  if (course.description) parts.push(`Course description: ${course.description}`)
  parts.push(`Overall: ${completedModules}/${totalModules} modules completed. Currently in module "${currentModuleTitle}".`)

  // Layer 2: Module map
  const topModules = modules.filter((m) => !m.parentModuleId)
  const moduleMap = topModules.map((m) => {
    const marker = m.id === kp.moduleId ? "★ CURRENT" : m.status === "completed" ? "✓" : "○"
    return `${marker} ${m.title} (${m.status === "completed" ? "done" : m.status === "in_progress" ? "in progress" : "not started"})`
  })
  parts.push(`\n## Course Map\n${moduleMap.join("\n")}`)

  // Layer 3: Current module detail
  const currentModule = topModules.find((m) => m.id === kp.moduleId)
  if (currentModule) {
    const kps = await prisma.knowledgePoint.findMany({
      where: { moduleId: currentModule.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, status: true, mastery: true },
    })

    const kpLines = kps.map((p) => {
      const marker = p.id === knowledgePointId ? "→ CURRENT" : p.status === "mastered" ? "✓" : p.status === "in_progress" ? "○" : "·"
      return `  ${marker} ${p.title} (mastery: ${p.mastery}/5)`
    })

    parts.push(`\n## Current Module: ${currentModule.title}`)
    parts.push(`Knowledge points:\n${kpLines.join("\n")}`)

    // Highlight weak points in same module
    const weakKps = kps.filter((p) => p.id !== knowledgePointId && p.mastery < 3)
    if (weakKps.length > 0) {
      const weakNames = weakKps.map((p) => `"${p.title}" (mastery ${p.mastery}/5)`).join(", ")
      parts.push(`\nRelated weak areas in this module: ${weakNames}. When relevant, suggest revisiting these.`)
    }
  }

  // Layer 4: Current knowledge point full content
  if (kp.content) {
    const plain = getContentPlain(kp.content)
    const truncated = plain.slice(0, 3000)
    parts.push(`\n## Current Topic: ${kp.title}`)
    parts.push(`Content:\n${truncated}${truncated.length >= 3000 ? "\n...(truncated)" : ""}`)
  }

  // Always include profile and anchors
  if (profile) {
    parts.push(`\n## User Learning Profile
- Knowledge Level: ${profile.knowledgeLevel}
- Learning Goals: ${profile.learningGoals}
- Preferred Style: ${profile.preferredStyle}
${profile.preferences ? `- Preferences: ${profile.preferences}` : ""}`)
  }

  if (anchors.length > 0) {
    parts.push(`\n## Permanent Instructions
${anchors.map((a) => `- [${a.category}] ${a.instruction}`).join("\n")}`)
  }

  if (weakAreas.length > 0) {
    parts.push(`\n## Known Weak Areas
${weakAreas.map((w) => `- ${w.topic} (severity: ${Math.round(w.severity * 100)}%): ${w.description}`).join("\n")}`)
  }

  // Inject teaching skill — dictates HOW the AI should interact
  parts.push(guideExplanationPrompt(kp.title, currentModuleTitle))

  const systemPrompt = parts.join("\n")

  const messages: { role: "user" | "assistant" | "system"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? []),
  ]

  return { systemPrompt, messages }
}
