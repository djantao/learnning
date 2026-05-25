"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, FileText, MessageSquare, Brain, Loader2 } from "lucide-react"
import Link from "next/link"

interface SearchResult {
  type: "note" | "conversation" | "flashcard"
  id: string
  title: string
  subtitle?: string
  tags?: string[]
  link: string
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("all")

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ search: q })
      const notesRes = await fetch(`/api/notes?${params}`)
      const notes = notesRes.ok ? await notesRes.json() : []

      const merged: SearchResult[] = [
        ...notes.map((n: any) => ({
          type: "note" as const,
          id: n.id,
          title: n.title,
          subtitle: n.excerpt?.slice(0, 100),
          tags: n.tags?.map((t: any) => t.tag.name) ?? [],
          link: `/notes/${n.id}`,
        })),
      ]

      setResults(merged)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const filtered = activeTab === "all" ? results : results.filter((r) => r.type === activeTab)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">搜索</h2>
        <p className="text-muted-foreground">搜索笔记、AI 对话和闪卡</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索笔记、对话、闪卡..."
          className="pl-10 text-lg"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部 ({results.length})</TabsTrigger>
          <TabsTrigger value="note">笔记 ({results.filter((r) => r.type === "note").length})</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : query.length < 2 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">输入至少 2 个字符开始搜索</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">没有找到相关结果</p>
              <p className="text-xs text-muted-foreground mt-1">尝试使用不同的关键词</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <Link key={`${item.type}-${item.id}`} href={item.link}>
                  <Card className="cursor-pointer transition-colors hover:border-primary">
                    <CardContent className="flex items-start gap-3 p-4">
                      {item.type === "note" && <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />}
                      {item.type === "conversation" && <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-purple-500" />}
                      {item.type === "flashcard" && <Brain className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{item.title}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {item.type === "note" ? "笔记" : item.type === "conversation" ? "对话" : "闪卡"}
                          </Badge>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5">
                            {item.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
