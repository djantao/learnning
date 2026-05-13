import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { rawText } = body

  if (!rawText || rawText.trim().length < 10) {
    return NextResponse.json({ error: "请输入至少 10 个字符的课程大纲" }, { status: 400 })
  }

  const prompt = `将以下课程大纲解析为JSON。规则：
- 表格：第一列=模块名，中间列=知识点列表（按<br>或编号拆分），最后一列=学习目标
- Markdown标题(#/##/###)对应模块层级，列表缩进对应子级
- Wiki链接去掉[[]]

输出JSON（不要markdown代码块）：
{"title":"课程标题","description":"1-2句话","modules":[{"title":"模块名","description":"学习目标","children":[{"title":"子模块名","knowledgePoints":[{"title":"知识点标题","content":"详细内容"}]}]}]}
无children则直接在modules下放knowledgePoints。

大纲：
${rawText.slice(0, 4000)}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 3000,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 返回格式异常，请重试", raw: text.slice(0, 300) }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: "AI 返回的 JSON 解析失败，请重试", raw: text.slice(0, 300) }, { status: 500 })
    }

    const { title, description, modules } = parsed

    if (!title || !modules || !Array.isArray(modules) || modules.length === 0) {
      return NextResponse.json({ error: "AI 未能识别出课程结构，请调整大纲格式后重试" }, { status: 500 })
    }

    // Batch create course + modules + knowledge points (use raw FK to avoid transaction issues with Neon HTTP adapter)
    const course = await prisma.course.create({
      data: {
        userId: session.user.id,
        title,
        description: description || null,
        icon: "📚",
      },
    })

    let sortOrder = 0
    for (const mod of modules) {
      const parentMod = await prisma.module.create({
        data: {
          courseId: course.id,
          title: mod.title,
          description: mod.description || null,
          sortOrder: sortOrder++,
        },
      })

      const children = mod.children || []
      if (children.length > 0) {
        let childOrder = 0
        for (const child of children) {
          const childMod = await prisma.module.create({
            data: {
              courseId: course.id,
              parentModuleId: parentMod.id,
              title: child.title,
              description: child.description || null,
              sortOrder: childOrder++,
            },
          })

          const kps = child.knowledgePoints || []
          let kpOrder = 0
          for (const kp of kps) {
            if (kp.title) {
              await prisma.knowledgePoint.create({
                data: {
                  moduleId: childMod.id,
                  title: kp.title,
                  content: kp.content || "",
                  sortOrder: kpOrder++,
                },
              })
            }
          }
        }
      } else {
        const kps = mod.knowledgePoints || []
        let kpOrder = 0
        for (const kp of kps) {
          if (kp.title) {
            await prisma.knowledgePoint.create({
              data: {
                moduleId: parentMod.id,
                title: kp.title,
                content: kp.content || "",
                sortOrder: kpOrder++,
              },
            })
          }
        }
      }
    }

    const fullCourse = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        modules: {
          orderBy: { sortOrder: "asc" },
          include: {
            childModules: {
              orderBy: { sortOrder: "asc" },
              include: { knowledgePoints: { orderBy: { sortOrder: "asc" } } },
            },
            knowledgePoints: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    })

    return NextResponse.json({ course: fullCourse, message: "课程已生成" }, { status: 201 })
  } catch (error) {
    console.error("generate-course error:", error)
    return NextResponse.json({ error: "课程生成失败，请稍后重试" }, { status: 500 })
  }
}
