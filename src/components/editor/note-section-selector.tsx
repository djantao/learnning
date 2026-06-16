"use client"

import Link from "next/link"
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface Section {
  id: string
  name: string
  notebookId: string
}

interface Notebook {
  id: string
  name: string
  sections: Section[]
}

interface Props {
  notebooks: Notebook[]
  sectionId: string | null
  onChange: (sectionId: string | null) => void
}

export function NoteSectionSelector({ notebooks, sectionId, onChange }: Props) {
  const selectedNotebook = sectionId
    ? notebooks.find((n) => n.sections.some((s) => s.id === sectionId))
    : null
  const selectedSection = sectionId
    ? notebooks.flatMap((n) => n.sections).find((s) => s.id === sectionId)
    : null

  // No notebooks exist yet — show link to create one
  if (notebooks.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">还没有笔记本</span>
        <Link href="/notebooks">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" />
            创建笔记本
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Select value={sectionId ?? ""} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="选择笔记本/章节" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">未分类</SelectItem>
          {notebooks.map((nb) => (
            <SelectGroup key={nb.id}>
              <SelectLabel>{nb.name}</SelectLabel>
              {nb.sections.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
                  <span>暂无章节</span>
                  <Link href="/notebooks" className="text-primary hover:underline">
                    去创建
                  </Link>
                </div>
              ) : (
                nb.sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))
              )}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {selectedNotebook && selectedSection && (
        <span className="text-sm text-muted-foreground">
          {selectedNotebook.name} / {selectedSection.name}
        </span>
      )}
    </div>
  )
}
