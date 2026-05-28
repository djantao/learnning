import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { bookTitle } = await req.json()
  if (!bookTitle || bookTitle.trim().length < 2) {
    return NextResponse.json({ error: "请输入书名（至少2个字符）" }, { status: 400 })
  }

  const prompt = `你是专业的技术书籍编目专家。请根据书名生成该书的结构化章节目录。

书名：${bookTitle.trim()}

要求：
1. 先判断你是否熟悉这本书：
   - 如果熟悉：基于你的知识生成完整的真实章节目录，包括所有主要章节和子章节
   - 如果不熟悉：基于书名和该领域常见知识体系，推断出可能涵盖的章节内容，并在 title 后加 "（基于领域知识推断）"
2. 每个章节包含：标题、简要描述（1-2句话写明该章讲什么）、包含的子章节列表
3. 子章节标题要具体，不能是"第一节""第二节"这种空泛命名
4. 章数控制在 6-15 章（真实反映书的章节数量）
5. 每章的子章节控制在 2-5 个
6. courseTitle 字段为课程标题（可以不同于书名，例如"XX读书笔记"或"XX实战指南"）

输出纯JSON（不要markdown代码块）：
{
  "courseTitle": "课程标题",
  "bookTitle": "原始书名",
  "chapters": [
    {
      "title": "第X章 章节名",
      "description": "本章简介",
      "subChapters": ["子章节1", "子章节2", "..."]
    }
  ]
}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 4000,
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 返回格式异常，请重试" }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.courseTitle || !parsed.chapters || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
      return NextResponse.json({ error: "未能识别出书籍大纲，请尝试更具体的书名" }, { status: 500 })
    }

    return NextResponse.json({
      courseTitle: parsed.courseTitle,
      bookTitle: parsed.bookTitle || bookTitle.trim(),
      chapters: parsed.chapters,
    })
  } catch (error) {
    console.error("generate-book-outline error:", error)
    return NextResponse.json({ error: "大纲生成失败，请稍后重试" }, { status: 500 })
  }
}
