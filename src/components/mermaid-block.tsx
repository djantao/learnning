"use client"

import { useEffect, useRef, useState } from "react"

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({ startOnLoad: false, theme: "default" })
        const { svg } = await mermaid.render(idRef.current, code)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "图表渲染失败")
      }
    }
    render()
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 my-4">
        <p className="text-xs text-red-600 dark:text-red-400 mb-2 font-medium">图表渲染失败</p>
        <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{code}</pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-lg bg-white dark:bg-slate-900 p-4 border"
    />
  )
}
