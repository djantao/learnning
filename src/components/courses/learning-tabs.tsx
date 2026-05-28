"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Section {
  id: string
  title: string
  content: string
}

function parseSections(md: string): Section[] {
  if (!md) return []

  const sections: Section[] = []
  const lines = md.split("\n")
  let currentTitle = "概述"
  let currentContent: string[] = []

  for (const line of lines) {
    if (/^## (.+)$/.test(line) && !line.startsWith("###")) {
      const text = currentContent.join("\n").trim()
      if (text) {
        const id = currentTitle.toLowerCase().replace(/[^\w一-鿿]+/g, "-").replace(/-+$/, "")
        sections.push({ id, title: currentTitle, content: text })
      }
      currentTitle = line.replace(/^## /, "").trim()
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  const text = currentContent.join("\n").trim()
  if (text) {
    const id = currentTitle.toLowerCase().replace(/[^\w一-鿿]+/g, "-").replace(/-+$/, "")
    sections.push({ id, title: currentTitle, content: text })
  }

  return sections
}

export function LearningTabs({
  content,
  renderSection,
}: {
  content: string
  renderSection: (sectionContent: string) => React.ReactNode
}) {
  const sections = parseSections(content)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const hash = window.location.hash?.slice(1)
    if (hash) {
      const idx = sections.findIndex((s) => s.id === hash)
      if (idx >= 0) setActiveIdx(idx)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, sections.length - 1))
      setActiveIdx(clamped)
      if (sections[clamped]) {
        window.location.hash = sections[clamped].id
      }
    },
    [sections],
  )

  if (sections.length <= 1) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {renderSection(content)}
        </div>
      </div>
    )
  }

  const current = sections[activeIdx]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center border-b bg-card/50 px-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-0.5 py-1.5 flex-1 min-w-0">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`text-xs px-2.5 py-1.5 rounded-t-md whitespace-nowrap transition-colors shrink-0 ${
                i === activeIdx
                  ? "bg-background border border-b-background text-foreground font-medium -mb-px"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 ml-2 shrink-0">
          <span className="text-xs text-muted-foreground mr-1">
            {activeIdx + 1}/{sections.length}
          </span>
          <Button variant="ghost" size="sm" onClick={() => goTo(activeIdx - 1)} disabled={activeIdx <= 0} className="h-7 w-7 p-0">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goTo(activeIdx + 1)}
            disabled={activeIdx >= sections.length - 1}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">{current?.title}</h2>
          {current && renderSection(current.content)}
        </div>
      </div>
    </div>
  )
}
