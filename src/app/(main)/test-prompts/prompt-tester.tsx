"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play } from "lucide-react"
import { renderMarkdown } from "@/lib/markdown"
import { MarkdownContent } from "@/components/courses/markdown-content"

interface KPItem { id: string; title: string }
interface ModuleItem { id: string; title: string; knowledgePoints: KPItem[]; childModules: ModuleItem[] }
interface CourseItem { id: string; title: string; modules: ModuleItem[] }

export function PromptTester({ courses }: { courses: CourseItem[] }) {
  const [selectedCourse, setSelectedCourse] = useState("")
  const [selectedKp, setSelectedKp] = useState("")
  const [difficulty, setDifficulty] = useState("入门")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ prompt: string; content: string } | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  const course = courses.find(c => c.id === selectedCourse)

  function getAllKPs(mods: ModuleItem[]): KPItem[] {
    const kps: KPItem[] = []
    for (const m of mods) {
      kps.push(...m.knowledgePoints)
      kps.push(...getAllKPs(m.childModules))
    }
    return kps
  }

  const allKPs = course ? getAllKPs(course.modules) : []

  async function test() {
    if (!selectedKp) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/ai/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePointId: selectedKp, difficulty }),
      })
      const data = await res.json()
      if (data.content) setResult(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">V2 提示词测试</h2>
        <p className="text-sm text-muted-foreground mt-1">选知识点 → 选难度 → 生成查看效果</p>
      </div>

      <Card>
        <CardContent className="flex items-end gap-3 py-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs font-medium">课程</label>
            <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v || ""); setSelectedKp("") }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="选课程" /></SelectTrigger>
              <SelectContent>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-medium">知识点</label>
            <Select value={selectedKp} onValueChange={(v) => setSelectedKp(v || "")}>
              <SelectTrigger><SelectValue placeholder="选知识点" /></SelectTrigger>
              <SelectContent>
                {allKPs.map(kp => <SelectItem key={kp.id} value={kp.id}>{kp.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">难度</label>
            <Select value={difficulty} onValueChange={(v) => v && setDifficulty(v)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="入门">入门</SelectItem>
                <SelectItem value="进阶">进阶</SelectItem>
                <SelectItem value="高阶">高阶</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={test} disabled={!selectedKp || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            生成
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => setShowPrompt(!showPrompt)}>
            {showPrompt ? "隐藏" : "查看"} Prompt
          </Button>
          {showPrompt && (
            <Card>
              <CardHeader><CardTitle className="text-sm">V2 Prompt</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-96 overflow-auto">{result.prompt}</pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">V2 输出 <Badge variant="secondary">{difficulty}</Badge></CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownContent content={result.content} />
            </CardContent>
          </Card>
        </div>
      )}

      {!result && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Play className="h-8 w-8 mb-2" />
            <p>选一个知识点，点「生成」查看 V2 提示词效果</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
