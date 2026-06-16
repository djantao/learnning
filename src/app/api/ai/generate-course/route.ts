import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { rawText, mode, topicName } = body

  let prompt: string

  if (mode === "topic" && topicName && topicName.trim().length >= 2) {
    // Topic mode: generate complete knowledge system from a topic name
    prompt = `你是一位资深的课程设计专家。请为以下主题生成一份完整的体系化学习课程。

主题：${topicName}

要求：
1. 生成 5-8 个模块，覆盖从入门基础到进阶实战的完整学习路径
2. 每个模块包含 3-5 个知识点
3. 知识点排列要有逻辑递进关系（先基础后深入）
4. 所有内容必须贴合"${topicName}"领域的实际知识体系，禁止编造不存在的概念
5. 模块标题要具体、可执行，不要用"概述""总结"这类空泛标题
6. 每个知识点的 content 写 1-2 句话简要说明
7. 每个模块需包含 estimatedMinutes（整数，单位分钟），根据知识点的深度和广度合理估算，参考：简单模块 10-20 分钟，中等模块 20-40 分钟，复杂模块 40-60 分钟

输出纯JSON（不要markdown代码块）：
{"title":"课程标题","description":"1-2句话概括课程定位和目标人群","modules":[{"title":"模块名","description":"学习目标","estimatedMinutes":30,"knowledgePoints":[{"title":"知识点标题","content":"1-2句简要说明"}]}]}`
  } else if (rawText && rawText.trim().length >= 10) {
    // Outline mode: parse user-provided syllabus
    prompt = `你是一个课程结构解析器。请严格按照用户提供的大纲生成课程JSON。

## 核心规则（优先级最高）
1. **严格忠实原文**：用户大纲里写的什么领域就是什么领域，禁止自行联想替换。例如用户写"Doris FE"指的是Apache Doris数据库的Frontend节点（查询解析、元数据管理），不是网页前端开发。你看到"FE"不要自动理解成"前端开发"。
2. **保留原始术语**：模块名、知识点标题尽量使用用户原文中的表述，不要改写。
3. **标题提取**：从大纲内容推断课程标题。如果大纲明确写了课程名，直接使用。
4. **description写1-2句话概括课程定位**。

## 解析规则
- 表格：第一列=模块名，中间列=知识点列表（按<br>或编号拆分），最后一列=学习目标
- Markdown标题(#/##/###)对应模块层级，列表缩进对应子级
- Wiki链接去掉[[]]
- 每个知识点的 content 写1-2句话简要说明，必须贴合大纲中的领域上下文

## 输出格式
输出纯JSON（不要markdown代码块）：
{"title":"课程标题","description":"1-2句话","modules":[{"title":"模块名","description":"学习目标","children":[{"title":"子模块名","knowledgePoints":[{"title":"知识点标题","content":"1-2句简要说明"}]}]}]}
无children则直接在modules下放knowledgePoints。

## 用户大纲
${rawText.slice(0, 4000)}`
  } else {
    return NextResponse.json({ error: "请提供课程大纲（至少10个字符）或课程主题（至少2个字符）" }, { status: 400 })
  }

  // Ensure user exists in DB (JWT may outlive DB records)
  const userExists = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!userExists) {
    try {
      await prisma.user.create({
        data: { id: session.user.id, email: session.user.email || `${session.user.id}@tmp.local`, name: session.user.name || "User" },
      })
    } catch {
      return NextResponse.json({ error: "用户会话异常，请退出重新登录" }, { status: 401 })
    }
  }

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: mode === "topic" ? 0.5 : 0.3,
      maxTokens: mode === "topic" ? 6000 : 4000,
      task: "generate_content",
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

    // Check duplicate course name for this user
    const existingCourse = await prisma.course.findFirst({
      where: { userId: session.user.id, title },
      select: { id: true },
    })
    if (existingCourse) {
      return NextResponse.json({ error: `已存在同名课程「${title}」`, existingCourseId: existingCourse.id }, { status: 409 })
    }

    // Batch create course + modules + knowledge points
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
          estimatedMinutes: typeof mod.estimatedMinutes === "number" ? mod.estimatedMinutes : null,
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
              estimatedMinutes: typeof child.estimatedMinutes === "number" ? child.estimatedMinutes : null,
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

    // Create reminder for the new course
    if (fullCourse) {
      try {
        await prisma.reminder.create({
          data: {
            userId: session.user.id,
            type: "study",
            title: `新课程已生成：${fullCourse.title}`,
            message: `包含 ${fullCourse.modules.length} 个模块，现在就开始学习吧！`,
            link: `/courses/${fullCourse.id}`,
          },
        })
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ course: fullCourse, message: "课程已生成" }, { status: 201 })
  } catch (error) {
    console.error("generate-course error:", error)
    return NextResponse.json({ error: "课程生成失败，请稍后重试" }, { status: 500 })
  }
}
