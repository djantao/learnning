import { auth } from "@/lib/auth"
import { buildContext } from "@/lib/ai/context-builder"
import { chatCompletionStream, chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { trackActivity } from "@/lib/activity"
import { NextResponse } from "next/server"

async function updateMasteryFromConversation(
  userId: string,
  knowledgePointId: string,
  userMessage: string,
  assistantResponse: string
) {
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: { select: { userId: true } } } } },
  })
  if (!kp || kp.module.course.userId !== userId) return

  if (kp.mastery >= 5) return

  const prompt = `Evaluate the quality of this learning conversation and suggest a mastery adjustment (0-5 scale).

Knowledge point: ${kp.title}
User message: ${userMessage.slice(0, 500)}
Assistant response: ${assistantResponse.slice(0, 500)}

Evaluation criteria:
- 5: User demonstrates deep understanding, asks insightful questions, connects concepts
- 4: User shows good comprehension, asks relevant questions
- 3: User participates actively, shows basic understanding
- 2: User asks simple questions, limited engagement
- 1: User barely engages or asks off-topic questions

Respond ONLY with a JSON object: {"suggestedMastery": 3}

Do NOT include any explanation, just the JSON.`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 50,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0])
    const suggestedMastery = typeof parsed.suggestedMastery === "number"
      ? Math.max(0, Math.min(5, parsed.suggestedMastery))
      : null

    if (suggestedMastery === null) return

    const newMastery = Math.max(
      kp.mastery,
      Math.round((kp.mastery * 0.8 + suggestedMastery * 0.4))
    )

    if (newMastery > kp.mastery) {
      await prisma.knowledgePoint.update({
        where: { id: knowledgePointId },
        data: {
          mastery: newMastery,
          status: newMastery >= 4 ? "mastered" : newMastery > 0 ? "in_progress" : "not_started",
          completedAt: newMastery >= 4 && !kp.completedAt ? new Date() : undefined,
        },
      })
    }
  } catch {
    // Silent fail — mastery update is best-effort
  }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get("conversationId")
  const knowledgePointId = searchParams.get("knowledgePointId")
  const courseId = searchParams.get("courseId")

  // Query by conversation ID
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: session.user.id },
    })
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      conversation,
      messages: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt })),
    })
  }

  // Query by knowledge point — return the most recent conversation
  if (knowledgePointId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        userId: session.user.id,
        knowledgePointId,
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    })
    if (!conversation) return NextResponse.json({ messages: [] })

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      conversation,
      messages: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt })),
    })
  }

  return NextResponse.json({ error: "Missing conversationId or knowledgePointId" }, { status: 400 })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { message, conversationId, noteId, courseId, knowledgePointId, history } = body as {
    message: string
    conversationId?: string
    noteId?: string
    courseId?: string
    knowledgePointId?: string
    history?: { role: string; content: string }[]
  }

  // Build AI context (profile + anchors + curriculum or note-based)
  const context = await buildContext({
    userId: session.user.id,
    topicNoteId: noteId,
    courseId,
    knowledgePointId,
    conversationHistory: history,
  })

  // Add user message
  context.messages.push({ role: "user", content: message })

  // Get or create conversation — scoped to course/knowledgePoint
  let conv = conversationId
    ? await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: session.user.id,
          ...(courseId ? { courseId } : {}),
          ...(knowledgePointId ? { knowledgePointId } : {}),
        },
      })
    : null
  const isNew = !conv
  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        title: message.slice(0, 100),
        relatedNoteIds: noteId ? JSON.stringify([noteId]) : "[]",
        courseId: courseId || null,
        knowledgePointId: knowledgePointId || null,
      },
    })
  }

  // Save user message
  await prisma.message.create({
    data: {
      conversationId: conv.id,
      role: "user",
      content: message,
      contextSnapshot: JSON.stringify({ profile: true, anchors: true, noteId, courseId, knowledgePointId }),
    },
  })

  // Track daily activity for new conversations
  if (isNew) {
    trackActivity(session.user.id, { aiConversations: 1 }).catch(() => {})
  }

  // Stream AI response
  const encoder = new TextEncoder()
  let fullResponse = ""

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await chatCompletionStream({
          messages: context.messages,
        })

        for await (const chunk of stream as any) {
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            fullResponse += delta
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }

        // Save assistant message
        await prisma.message.create({
          data: {
            conversationId: conv!.id,
            role: "assistant",
            content: fullResponse,
            tokenCount: Math.ceil(fullResponse.length / 3),
          },
        })

        // Update conversation
        await prisma.conversation.update({
          where: { id: conv!.id },
          data: {
            messageCount: { increment: 2 },
            totalTokens: { increment: Math.ceil(fullResponse.length / 3) + Math.ceil(message.length / 3) },
          },
        })

        // Async: Update knowledge point mastery based on conversation quality
        if (knowledgePointId && message.length >= 10) {
          updateMasteryFromConversation(session.user.id, knowledgePointId, message, fullResponse).catch(() => {})
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: conv!.id })}\n\n`))
        controller.close()
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
