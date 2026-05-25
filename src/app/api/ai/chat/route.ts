import { auth } from "@/lib/auth"
import { buildContext } from "@/lib/ai/context-builder"
import { chatCompletionStream } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { trackActivity } from "@/lib/activity"
import { NextResponse } from "next/server"

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
