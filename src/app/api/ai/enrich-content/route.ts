import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { knowledgePointId, title, moduleTitle, courseTitle, level } = body

  if (!knowledgePointId || !title) {
    return NextResponse.json({ error: "缺少知识点信息" }, { status: 400 })
  }

  const difficulty = level === "进阶" || level === "高阶" ? level : "入门"

  // Verify ownership
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { module: { include: { course: true } } },
  })
  if (!kp || kp.module.course.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const contextInfo = [courseTitle, moduleTitle].filter(Boolean).join(" > ")

  const levelPrompt = difficulty === "入门"
    ? `## 入门 — 任务驱动教学

你面对的学生：有课程领域基础认知，但从未用过这个知识点。

### 写作铁律
- **不写概念解释章节**。把概念融进任务，做事中理解。
- **不写 API 字典**。孤立函数说明毫无意义——函数在解决具体问题时才出现。
- **开头 3 秒勾住人**。第一句描述一个让他痛的场景，然后说"来，解决它"。
- **看完必须能做一件事**。学生看完不知道怎么用，内容就是垃圾。

### 输出结构

🎯 你会解决什么问题
描述一个真实的小任务（必须有具体的场景细节，不能是"我们需要操作文件"这种空话）。让学生立刻知道"学了这个能干嘛"。2-3 句。

🏗 动手实操
把任务拆成 3-5 步。每步一段简短代码（≤8 行）+ 一段解释。解释不说"这个函数的作用是..."，说"我们这行在做什么，为什么这样做"。代码从最小可用开始，逐步加功能。关键参数在上下文中解释，不要单独列参数表。

💡 你学会了什么
任务完成后自然总结 3 条收获，从刚才的操作中提炼，不要重复概念定义。

🔧 独立挑战
给一个和实操相似但不同的新需求。不给步骤，只给需求 + 提示 + 参考答案。让学生自己写。

🚦 下一步学什么
一句话。建议具体的学习路径，比如"你已经能用 os 整理文件了，下一步建议学 pathlib"。`
    : difficulty === "进阶"
    ? `## 进阶 — 任务驱动教学

你面对的学生：已经会基本用法，但遇到复杂场景不知道怎么下手。

### 写作铁律
- **不复习基础语法**。学生已经会了，直接进入正题。
- **核心是"选择"**。进阶不是学更多函数，是学"什么时候用什么方案、为什么"。
- **必须踩坑**。展示一段有问题的代码，让学生看到报错，再展示正确写法。

### 输出结构

🎯 这次解决什么问题
描述一个接近真实工作的复杂场景（涉及多步骤、需要做取舍决策）。2-3 句。

🏗 动手实操
分步解决。至少一步出现"两种做法"的对比——为什么选 A 不选 B？代价是什么？代码接近生产环境，包含边界处理。

⚠️ 踩个坑
故意展示一段常见错误写法（给出报错信息或错误结果），解释为什么错，再给正确写法。学生踩过坑才会记住。

💡 关键收获
4-5 条，侧重选择逻辑和注意事项。

🔧 独立挑战
一个需要自己设计方案的复杂任务。给需求和约束条件，不给步骤。附参考答案。

🚦 下一步
一句话。`
    : `## 高阶 — 任务驱动教学

你面对的学生：已经熟练掌握这个知识点，需要应对极端场景和工程化挑战。

### 写作铁律
- **不讲基础用法**。学生不需要再看示例。
- **聚焦极端情况**。大数据量、高并发、跨平台兼容、安全漏洞——这才是高阶关心的。
- **要看到"里面"**。不是用 API，是理解 API 底下做了什么。

### 输出结构

🎯 这次解决什么问题
描述一个真实工程场景，必须有具体的数据量级或性能指标（如"单机处理 10GB 日志"或"1000 QPS 下的连接池配置"）。2-3 句。

🏗 动手实操
分步解决，深入到原理层。至少一处性能分析或源码级解释。代码覆盖边界情况和异常处理。

⚠️ 两个深坑
写出 2 个容易被忽视的工程陷阱。每个说明：场景→出问题的原因→底层机制→如何避免。

💡 关键收获
5 条，侧重架构决策、性能优化、安全考量。

🔧 独立挑战
一个开放式综合设计任务。只给目标和性能/安全约束，不给提示。附参考答案。

🚦 下一步
一句话。`

  const prompt = `你是课程讲师。请用"任务驱动"方式为以下知识点生成学习内容。

课程领域：${contextInfo || "未指定"}
知识点：${title}
难度：${difficulty}

领域约束：所有场景、代码必须使用"${contextInfo || "未指定"}"领域的真实工具链。任务必须是该领域从业者真实会遇到的工作场景，不能是编造的玩具示例。

${levelPrompt}

直接输出 Markdown。`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: difficulty === "高阶" ? 4000 : difficulty === "进阶" ? 3200 : 2500,
    })

    const content = result.choices?.[0]?.message?.content ?? ""

    if (!content || content.trim().length < 20) {
      return NextResponse.json({ error: "AI 返回内容不足" }, { status: 500 })
    }

    // Save to DB
    await prisma.knowledgePoint.update({
      where: { id: knowledgePointId },
      data: { content },
    })

    return NextResponse.json({ content, message: "内容已生成" })
  } catch (error) {
    console.error("enrich-content error:", error)
    return NextResponse.json({ error: "内容生成失败" }, { status: 500 })
  }
}
