const MARKER_START = "<!-- DIFFICULTY:"
const MARKER_END = "<!-- /DIFFICULTY:"

/** 解析 content 字段为 { 入门: "...", 进阶: "...", 高阶: "..." } */
export function parseContentLevels(content: string): Record<string, string> {
  const levels: Record<string, string> = {}

  if (!content) return levels

  const hasNewFormat = content.includes(MARKER_START) && content.includes(MARKER_END)

  if (!hasNewFormat) {
    // 旧格式兼容：单个 <!-- difficulty: X --> 后缀
    const oldMatch = content.match(/\n\n<!-- difficulty: (.+?) -->$/)
    if (oldMatch) {
      const oldLevel = oldMatch[1]
      levels[oldLevel] = content.replace(/\n\n<!-- difficulty: .+ -->$/, "").trim()
    } else {
      levels["入门"] = content.trim()
    }
    return levels
  }

  const regex = /<!-- DIFFICULTY:(.+?) -->\n([\s\S]*?)\n<!-- \/DIFFICULTY:\1 -->/g
  let match
  while ((match = regex.exec(content)) !== null) {
    levels[match[1].trim()] = match[2].trim()
  }

  return levels
}

/** 构建多级 content 字段 */
export function buildContentField(levels: Record<string, string>): string {
  const blocks: string[] = []
  for (const level of ["入门", "进阶", "高阶"]) {
    const text = levels[level]
    if (text?.trim()) {
      blocks.push(`<!-- DIFFICULTY:${level} -->\n${text.trim()}\n<!-- /DIFFICULTY:${level} -->`)
    }
  }
  return blocks.join("\n\n")
}

/** 获取指定难度的内容，不存在返回 null */
export function getContentForLevel(content: string, level: string): string | null {
  const levels = parseContentLevels(content)
  return levels[level]?.trim() || null
}

/** 提取纯文本内容（给 AI context 用），优先取当前难度，fallback 到任意已有难度 */
export function getContentPlain(content: string, preferredLevel?: string): string {
  const levels = parseContentLevels(content)
  if (preferredLevel && levels[preferredLevel]?.trim()) {
    return levels[preferredLevel].trim()
  }
  for (const lv of ["入门", "进阶", "高阶"]) {
    if (levels[lv]?.trim()) return levels[lv].trim()
  }
  return ""
}

/** 检查指定难度是否已有缓存 */
export function hasContentForLevel(content: string, level: string): boolean {
  return getContentForLevel(content, level) !== null
}
