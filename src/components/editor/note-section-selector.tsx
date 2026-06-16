"use client"

import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

  return (
    <div className="flex items-center gap-4">
      <Select value={sectionId || ""} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="选择笔记本/章节" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">未分类</SelectItem>
          {notebooks.map((nb) => (
            <SelectGroup key={nb.id}>
              <SelectLabel>{nb.name}</SelectLabel>
              {nb.sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
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
