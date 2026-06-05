"use client"

import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { renderMarkdown } from "@/lib/markdown"
import { MermaidBlock } from "@/components/mermaid-block"

interface Placeholder {
  key: string
  html: string
}

/**
 * 用占位符替换 Mermaid 和代码块，避免 renderMarkdown 二次转义
 */
function protectBlocks(md: string): { text: string; blocks: Placeholder[] } {
  const blocks: Placeholder[] = []
  let idx = 0

  let text = md.replace(
    /```mermaid\s*[\r\n]+([\s\S]*?)```/g,
    (_, code: string) => {
      const key = `__MERMAID_${idx++}__`
      blocks.push({
        key,
        html: `<div class="mermaid-placeholder" data-mermaid-code="${encodeURIComponent(code.trim())}"></div>`,
      })
      return key
    },
  )

  // 其他代码块 → <pre>
  text = text.replace(
    /```(\w*)\s*[\r\n]+([\s\S]*?)```/g,
    (_, lang: string, code: string) => {
      const key = `__CODE_${idx++}__`
      const escaped = code
        .trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
      blocks.push({
        key,
        html: `<pre class="bg-muted/50 rounded-lg p-3 my-3 overflow-x-auto text-xs"><code>${escaped}</code></pre>`,
      })
      return key
    },
  )

  return { text, blocks }
}

function restoreBlocks(html: string, blocks: Placeholder[]): string {
  let result = html
  for (const { key, html: blockHtml } of blocks) {
    result = result.replace(key, blockHtml)
  }
  return result
}

export function MarkdownContent({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rootsRef = useRef<ReturnType<typeof createRoot>[]>([])

  useEffect(() => {
    if (!containerRef.current) return

    for (const root of rootsRef.current) {
      root.unmount()
    }
    rootsRef.current = []

    const placeholders = containerRef.current.querySelectorAll<HTMLDivElement>(".mermaid-placeholder")
    for (const el of placeholders) {
      const code = decodeURIComponent(el.getAttribute("data-mermaid-code") || "")
      if (!code) continue
      const root = createRoot(el)
      rootsRef.current.push(root)
      root.render(<MermaidBlock code={code} />)
    }
  }, [content])

  // 1. 保护代码块 → 2. markdown 转 HTML → 3. 恢复代码块
  const { text, blocks } = protectBlocks(content)
  const html = renderMarkdown(text)
  const finalHtml = restoreBlocks(html, blocks)

  return (
    <div
      ref={containerRef}
      className="text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: finalHtml }}
    />
  )
}
