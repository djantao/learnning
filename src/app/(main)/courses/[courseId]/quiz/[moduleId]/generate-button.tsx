"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function GenerateQuizButton({ moduleId }: { moduleId: string; courseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/modules/${moduleId}/quiz`, { method: "POST" })
      if (res.ok) router.refresh()
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <Button onClick={generate} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
      {loading ? "生成中..." : "AI 生成测验"}
    </Button>
  )
}
