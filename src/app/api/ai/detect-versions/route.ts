import { auth } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { topicName } = await req.json()
  if (!topicName || topicName.trim().length < 2) {
    return NextResponse.json({ error: "请输入至少 2 个字符的课程主题" }, { status: 400 })
  }

  const prompt = `你是技术文档版本分析专家。请分析以下技术主题，判断它是否有多个主要版本，并列出这些版本。

主题：${topicName.trim()}

规则：
1. 仅当该技术/框架/工具确实存在多个主要版本时才返回版本列表
2. 版本号格式应统一，如 "1.18"、"v2.0"、"2024.1" 等
3. 最多列出 6 个最常用/最新的版本
4. 如果不存在多个主要版本（如通用概念"机器学习"、"数据结构"），返回空列表
5. 如果该主题本身就是一个通用概念而非具体工具/框架，返回空列表

输出纯 JSON（不要markdown代码块）：
{"hasVersions": true/false, "versions": ["版本1", "版本2", ...], "recommendation": "推荐版本（如果没有明确推荐则留空）"}`

  try {
    const result = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 500,
      task: "detect_versions",
    })

    const text = result.choices?.[0]?.message?.content ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ hasVersions: false, versions: [] })
    }

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ hasVersions: false, versions: [] })
    }

    const versions = Array.isArray(parsed.versions) ? parsed.versions.filter((v: string) => typeof v === "string" && v.trim()) : []
    return NextResponse.json({
      hasVersions: !!parsed.hasVersions && versions.length > 0,
      versions,
      recommendation: parsed.recommendation || "",
    })
  } catch (error) {
    console.error("detect-versions error:", error)
    return NextResponse.json({ hasVersions: false, versions: [] })
  }
}
