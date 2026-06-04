import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { getContentPlain } from "@/lib/ai/skills/content-levels"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

interface Segment {
  speaker: string
  text: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { knowledgePointId, mode } = await req.json()
  if (!knowledgePointId) return NextResponse.json({ error: "缺少知识点ID" }, { status: 400 })

  // 如果有缓存的播客，直接返回
  if (mode === "load") {
    const existing = await prisma.podcast.findFirst({
      where: { userId: session.user.id, knowledgePointId },
      orderBy: { createdAt: "desc" },
    })
    if (existing) {
      return NextResponse.json({
        id: existing.id,
        segments: JSON.parse(existing.script) as Segment[],
        title: existing.title,
        audioBase64: existing.audioData,
        duration: existing.duration,
      })
    }
    return NextResponse.json(null)
  }

  // 生成播客脚本
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: true } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const contentText = getContentPlain(kp.content, "入门") || getContentPlain(kp.content) || ""
  const snippet = contentText.slice(0, 3000)

  const prompt = `你是一个播客脚本编剧。请根据以下知识点内容，编写一段生动有趣的中文播客对话。

两位主持人：小明（技术专家，善于深入浅出地讲解）和小红（好奇学习者，善于提出好问题）

知识点：${kp.title}
所属课程：${kp.module.course.title}
所属模块：${kp.module.title}

参考内容：
${snippet || "暂无详细内容，请根据知识点标题发挥"}

【播客要求】
1. 对话风格轻松自然，像朋友聊天，不要太正式
2. 小红先开口，引出话题并提出大家常有的困惑
3. 小明用通俗的类比和例子来解释核心概念
4. 对话中要有互动感：小红追问、小明补充、两人偶尔接话
5. 长度控制在 8-12 轮对话（每轮一人说一段）
6. 结尾小红做简短总结，小明给一个学习建议

【输出格式】每行一段，用"小明："或"小红："开头。

小红：嗨大家好！今天我们来聊聊一个很有意思的话题...
小明：对，这个话题确实非常重要...

只输出对话文本，不要任何其他内容。`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      maxTokens: 3000,
      stream: false,
    })

    const script = result.choices?.[0]?.message?.content ?? ""
    if (!script || script.trim().length < 50) {
      return NextResponse.json({ error: "AI 返回播客脚本不足" }, { status: 500 })
    }

    // 解析对话片段
    const lines = script.split("\n").filter((l) => l.trim())
    const segments: Segment[] = []

    for (const line of lines) {
      const m1 = line.match(/^小明[：:]\s*(.+)/)
      const m2 = line.match(/^小红[：:]\s*(.+)/)
      if (m1) {
        segments.push({ speaker: "小明", text: m1[1].trim() })
      } else if (m2) {
        segments.push({ speaker: "小红", text: m2[1].trim() })
      }
    }

    // 备用解析
    if (segments.length < 4) {
      segments.length = 0
      for (const line of lines) {
        const m = line.match(/^(小明|小红)[：:]\s*(.+)/)
        if (m) {
          segments.push({ speaker: m[1], text: m[2].trim() })
        }
      }
    }

    if (segments.length < 4) {
      return NextResponse.json({ error: "AI 返回对话格式无法解析" }, { status: 500 })
    }

    const title = `关于「${kp.title}」的播客`
    // 粗略估算：中文 ~4 字/秒
    const duration = segments.reduce((sum, s) => sum + s.text.length, 0) / 4

    // 持久化脚本到数据库（音频由客户端合成）
    const podcast = await prisma.podcast.create({
      data: {
        userId: session.user.id,
        knowledgePointId,
        title,
        script: JSON.stringify(segments),
        duration,
      },
    })

    return NextResponse.json({
      id: podcast.id,
      segments,
      title,
      duration,
    })
  } catch (error) {
    console.error("generate-podcast error:", error)
    return NextResponse.json({ error: "播客生成失败" }, { status: 500 })
  }
}
