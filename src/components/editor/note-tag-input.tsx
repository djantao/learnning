"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X, Plus } from "lucide-react"

interface Props {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}

export function NoteTagInput({ tags, onAdd, onRemove }: Props) {
  const [tagInput, setTagInput] = useState("")

  function addTag() {
    const name = tagInput.trim()
    if (name && !tags.includes(name)) {
      onAdd(name)
    }
    setTagInput("")
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => onRemove(tag)}>
          {tag}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
        placeholder="添加标签..."
        className="h-7 w-32 border-dashed text-xs"
      />
      {tagInput && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addTag}>
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
