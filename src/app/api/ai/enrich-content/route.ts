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

  // Return cached content if already has substantial content, not a forced regenerate,
  // and the cached content matches the requested difficulty level
  const contentHasDifficultyTag = kp.content && kp.content.includes(`<!-- difficulty: ${difficulty} -->`)
  const stripDifficultyTag = (c: string) => c.replace(/\n\n<!-- difficulty: .+ -->$/, "")

  if (!regenerate && kp.content && kp.content.trim().length >= 100 && kp.content.includes("## ") && contentHasDifficultyTag) {
    return NextResponse.json({ content: stripDifficultyTag(kp.content), cached: true, message: "已加载已有内容" })
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
    : `你是一位拥有10年教学经验的金牌讲师，擅长将复杂技术/知识转化为通俗易懂、适合自学的课程内容。
你必须严格遵守以下所有规则，违反任何一条都视为生成失败：

1. 【角色定位】
   - 只输出课程文档内容，不输出任何解释性、客套性文字
   - 语言风格：专业、严谨、简洁，避免口语化和冗余表达
   - 面向受众：有1年以上开发经验的工程师
   - 前置知识：掌握该领域基础概念和常用工具

2. 【输出结构强制要求】
   每个小节必须严格按照以下顺序输出，不得调整顺序，不得缺少任何模块：
   # {小节标题}
   ## 本节学习目标
   - 3-5条可量化的学习目标，使用"能够+动词"句式
   ## 核心概念讲解
   - 每个概念单独成段，先给出精确定义，再用通俗类比解释
   - 重要概念用**加粗**标记
   - 禁止大段文字，每段不超过3行
   ## 原理/流程详解
   - 用分步说明或逻辑推导的方式讲解
   - 复杂流程必须使用有序列表
   - 关键步骤用**加粗**标记
   ## 典型案例/示例
   - 至少1个完整的、可复现的案例
   - 代码示例必须添加详细注释，每行注释不超过20字
   - 案例后必须有"案例解析"模块，说明核心思路
   ## 常见误区与易错点
   - 3-5条学习者最容易犯的错误
   - 每条说明"错误做法"和"正确做法"
   ## 本节要点总结
   - 用无序列表列出本节最核心的3-5个知识点
   ## 自我检测题
   - 2道选择题+1道简答题
   - 选择题必须给出4个选项和正确答案
   - 简答题必须给出参考答案要点

3. 【质量红线】
   - 绝对禁止编造概念、原理和数据
   - 前后内容必须保持一致，不得出现矛盾
   - 禁止出现"下一节我们将讲解"、"如上所述"等跨节引用
   - 所有代码必须语法正确，可直接运行
   - 禁止输出任何与本节内容无关的信息`

  const difficultyConstraint =
    difficulty === "高阶"
      ? "必须严格遵循金牌讲师输出结构，每个小节必须包含完整的7个模块（学习目标→核心概念→原理详解→典型案例→常见误区→要点总结→自我检测）。所有代码示例必须语法正确可直接运行，概念定义必须精确不能编造，前后内容必须一致无矛盾。"
      : difficulty === "进阶"
      ? "代码示例必须完整可运行，不能写伪代码或省略号。"
      : "任务必须是该领域从业者真实会遇到的工作场景，不能是编造的玩具示例。"

  const prompt = `你是课程讲师。请按照${difficulty}难度的教学规范，为指定知识点生成学习内容。

课程领域：${contextInfo || "未指定"}
知识点：${title}
难度：${difficulty}

领域约束：所有内容必须使用"${contextInfo || "未指定"}"领域的真实工具链和技术栈。${difficultyConstraint}

${levelPrompt}

直接输出 Markdown。`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: difficulty === "高阶" ? 0.3 : 0.5,
      topP: difficulty === "高阶" ? 0.7 : undefined,
      maxTokens: difficulty === "高阶" ? 4000 : difficulty === "进阶" ? 3200 : 2500,
      stream: difficulty === "高阶" ? false : true,
    })

    const content = result.choices?.[0]?.message?.content ?? ""

    if (!content || content.trim().length < 20) {
      return NextResponse.json({ error: "AI 返回内容不足" }, { status: 500 })
    }

    // Save to DB with difficulty tag for cache-aware retrieval
    const taggedContent = content + `\n\n<!-- difficulty: ${difficulty} -->`
    await prisma.knowledgePoint.update({
      where: { id: knowledgePointId },
      data: { content: taggedContent },
    })

    return NextResponse.json({ content, message: "内容已生成" })
  } catch (error) {
    console.error("enrich-content error:", error)
    return NextResponse.json({ error: "内容生成失败" }, { status: 500 })
  }
}
