"use client"

import { useMemo } from "react"
import { MermaidBlock } from "@/components/mermaid-block"

interface Block {
  type: "text" | "mermaid" | "code"
  content: string
  lang?: string
}

/**
 * 将 markdown 内容拆分为文本块、mermaid 块和代码块
 */
function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const regex = /```(mermaid|\w*)\s*[\r\n]+([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(md)) !== null) {
    // match 之前的文本
    if (match.index > lastIndex) {
      blocks.push({ type: "text", content: md.slice(lastIndex, match.index) })
    }
    const lang = match[1] || ""
    const code = match[2].trim()
    if (lang === "mermaid") {
      blocks.push({ type: "mermaid", content: code })
    } else {
      blocks.push({ type: "code", content: code, lang })
    }
    lastIndex = regex.lastIndex
  }

  // 剩余文本
  if (lastIndex < md.length) {
    blocks.push({ type: "text", content: md.slice(lastIndex) })
  }

  return blocks
}

function TextBlock({ text }: { text: string }) {
  const html = useMemo(() => renderInlineMarkdown(text), [text])

  if (!text.trim()) return null

  return (
    <div
      className="my-2 break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function renderInlineMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  html = html
    .replace(/^#### (.+)$/gm, "<h4 class='text-base font-semibold mt-4 mb-2'>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3 class='text-lg font-semibold mt-4 mb-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-xl font-bold mt-6 mb-3'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-2xl font-bold mt-6 mb-3'>$1</h1>")
    .replace(/^---$/gm, "<hr class='my-4 border-border'/>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 rounded text-xs break-all'>$1</code>")
    .replace(/\n- (.+)/g, "\n<li class='ml-3 sm:ml-4 list-disc break-words'>$1</li>")
    .replace(/\n\n/g, "</p><p class='my-2'>")
    .replace(/\n/g, "<br/>")

  return `<p class='my-2 break-words'>${html}</p>`
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="my-2 rounded-md bg-muted/80 p-2 sm:p-3 overflow-x-auto -mx-2 sm:mx-0">
      {lang && <div className="text-[10px] text-muted-foreground mb-1">{lang}</div>}
      <pre className="text-xs font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content])

  return (
    <div className="text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "mermaid":
            return <MermaidBlock key={i} code={block.content} />
          case "code":
            return <CodeBlock key={i} code={block.content} lang={block.lang} />
          case "text":
            return <TextBlock key={i} text={block.content} />
        }
      })}
    </div>
  )
}
