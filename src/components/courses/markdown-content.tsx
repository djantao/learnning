"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"
import { MermaidBlock } from "@/components/mermaid-block"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-gray-400 hover:text-white transition-colors"
      onClick={handleCopy}
      title={copied ? "已复制" : "复制代码"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

function CodeBlockWrapper({ lang, children }: { lang?: string; children: React.ReactNode }) {
  const codeRef = useRef<HTMLPreElement>(null)
  const [codeText, setCodeText] = useState("")

  useEffect(() => {
    if (codeRef.current) {
      setCodeText(codeRef.current.textContent || "")
    }
  }, [children])

  if (lang === "mermaid") {
    return <MermaidBlock code={codeText} />
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/60 bg-[#0d1117] shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </span>
          {lang && (
            <span className="ml-2 text-xs font-medium text-gray-400">{lang}</span>
          )}
        </div>
        <CopyButton code={codeText} />
      </div>
      <div className="overflow-x-auto">
        <pre ref={codeRef} className="!m-0 !bg-transparent !p-0">
          {children}
        </pre>
      </div>
    </div>
  )
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="my-2 leading-relaxed text-foreground/90">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-primary/40 pl-4 italic text-muted-foreground bg-muted/30 py-2 pr-3 rounded-r-lg">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "")
            if (match) {
              return (
                <code
                  className={`${className} !bg-transparent !p-4 !text-[13px] !leading-relaxed`}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono text-primary/90 border border-border/50"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ className, children, ...props }) => {
            const codeEl = Array.isArray(children) ? children[0] : children
            let lang = ""
            if (codeEl && typeof codeEl === "object" && "props" in codeEl) {
              const codeClassName = (codeEl as any).props?.className || ""
              const match = /language-(\w+)/.exec(codeClassName)
              if (match) lang = match[1]
            }

            if (lang) {
              return (
                <CodeBlockWrapper lang={lang}>
                  {children}
                </CodeBlockWrapper>
              )
            }

            return (
              <pre className={`${className || ""}`} {...props}>
                {children}
              </pre>
            )
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 px-3 py-2">{children}</td>
          ),
          hr: () => <hr className="my-4 border-border" />,
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt}
              className="my-3 max-w-full rounded-lg shadow-sm"
              loading="lazy"
            />
          ),
          input: ({ type, checked }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 h-4 w-4 rounded border-border accent-primary"
                />
              )
            }
            return null
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          del: ({ children }) => (
            <del className="text-muted-foreground">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
