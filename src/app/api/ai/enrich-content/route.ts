import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { knowledgePointId, title, moduleTitle, courseTitle, level, regenerate } = body

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

  // Return cached content if already has substantial content and not a forced regenerate
  if (!regenerate && kp.content && kp.content.trim().length >= 100 && kp.content.includes("## ")) {
    return NextResponse.json({ content: kp.content, cached: true, message: "已加载已有内容" })
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
    ? `## 进阶 — 结构化技术教程

你面对的学生：有一定基础，需要系统深入地掌握该知识点的核心原理和工程实践。

### 写作铁律
- **专业简洁**。不啰嗦，不讲基础概念，面向有经验的开发者。
- **代码驱动**。每个知识点必须搭配可直接运行的代码示例和详细注释。
- **对比思维**。容易混淆的概念和方法必须放在一起对比说明。
- **实战导向**。所有示例代码必须可直接运行，不写伪代码。

### 输出结构

📖 核心概述
先总述该知识点的核心作用、适用场景和在技术生态中的定位。回答"为什么要学这个"。2-3 句。

📋 知识拆解
按功能模块划分 3-5 个清晰的子知识点，用列表简要说明每个子点解决什么问题。让读者一眼看清本章节的结构脉络。

🏗 逐个详解
每个子知识点一个 ## 小节，包含：
- 概念说明：1-2 句点到为止，不写长篇定义
- 可直接运行的完整代码示例（含关键行注释，说明每步在做什么、为什么这样做）
- 该子点的关键注意事项

⚖️ 概念对比
如果存在容易混淆的概念或方法（如 A vs B），用一个对比段落或表格说明：
- 各自的适用场景
- 选 A 不选 B 的理由
- 性能/可读性/维护性方面的取舍

⚠️ 常见陷阱
列出 2-3 个该知识点最容易踩的坑：
- 给出错误写法/误区
- 解释为什么错
- 给出正确做法

🌟 最佳实践
推荐 2-3 条现代最佳实践或社区推荐的替代方案。如果有旧方式已被新方案取代，明确指出并说明升级理由。

📝 总结
整体总结 3-5 条关键收获，提炼本文最核心的要点。让读者看完总结就能回忆起全文精华。`
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

  const isAdvanced = difficulty === "进阶"

  const prompt = `你是课程讲师。请按照${difficulty}难度的教学规范，为指定知识点生成学习内容。

课程领域：${contextInfo || "未指定"}
知识点：${title}
难度：${difficulty}

领域约束：所有场景、代码必须使用"${contextInfo || "未指定"}"领域的真实工具链。${isAdvanced ? "代码示例必须完整可运行，不能写伪代码或省略号。" : "任务必须是该领域从业者真实会遇到的工作场景，不能是编造的玩具示例。"}

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
