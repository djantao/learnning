"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function OverdueActions({ moduleId }: { moduleId: string }) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function markComplete() {
    setLoading("complete")
    await fetch(`/api/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    })
    setLoading(null)
    router.refresh()
  }

  async function snooze() {
    setLoading("snooze")
    const d = new Date()
    d.setDate(d.getDate() + 3)
    await fetch(`/api/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: d.toISOString() }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-1 shrink-0">
      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={markComplete} disabled={loading !== null}>
        {loading === "complete" ? <Loader2 className="h-3 w-3 animate-spin" /> : "标记完成"}
      </Button>
      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={snooze} disabled={loading !== null}>
        {loading === "snooze" ? <Loader2 className="h-3 w-3 animate-spin" /> : "推迟3天"}
      </Button>
    </div>
  )
}
