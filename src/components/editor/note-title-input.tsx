"use client"

import { Input } from "@/components/ui/input"

interface Props {
  value: string
  onChange: (value: string) => void
}

export function NoteTitleInput({ value, onChange }: Props) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="笔记标题..."
      className="text-xl font-bold border-none px-0 h-auto focus-visible:ring-0"
    />
  )
}
