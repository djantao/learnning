"use client"

import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { renderMarkdown } from "@/lib/markdown"
import { MermaidBlock } from "@/components/mermaid-block"

function processMarkdown(md: string): string {
  return md.replace(
    /```mermaid\n([\s\S]*?)```/g,
    (_, code: string) =>
      `<div class="mermaid-placeholder" data-mermaid-code="${encodeURIComponent(code.trim())}"></div>`,
  )
}

export function MarkdownContent({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rootsRef = useRef<ReturnType<typeof createRoot>[]>([])

  useEffect(() => {
    if (!containerRef.current) return

    // Cleanup previous roots
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

  const processed = processMarkdown(content)
  const html = renderMarkdown(processed) || ""

  return (
    <div
      ref={containerRef}
      className="text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
