"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tags, Search, FileText, Loader2 } from "lucide-react"
import Link from "next/link"

interface TagWithCount {
  id: string
  name: string
  color: string
  _count?: { pages: number }
}

interface Page {
  id: string
  title: string
  slug: string
  excerpt: string | null
  tags: { tag: { id: string; name: string } }[]
  updatedAt: string
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => { setTags(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedTag) { setPages([]); return }
    fetch(`/api/notes?tag=${encodeURIComponent(selectedTag)}`)
      .then((r) => r.json())
      .then(setPages)
      .catch(() => setPages([]))
  }, [selectedTag])

  const filteredTags = tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">标签</h2>
          <p className="text-muted-foreground">用标签组织和发现你的知识</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tags.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Tags className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">还没有标签</h3>
            <p className="mt-1 text-sm text-muted-foreground">创建笔记时添加标签，标签会自动出现在这里</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          {/* Tag List */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索标签..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    selectedTag === tag.name
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {tag.name}
                  {tag._count?.pages !== undefined && (
                    <span className="text-xs opacity-70">({tag._count.pages})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tagged Pages */}
          <div>
            {!selectedTag ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">选择一个标签查看关联的笔记</p>
                </CardContent>
              </Card>
            ) : pages.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">该标签下暂无笔记</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  标签「{selectedTag}」的笔记 ({pages.length})
                </h3>
                {pages.map((page) => (
                  <Link key={page.id} href={`/notes/${page.id}`}>
                    <Card className="cursor-pointer transition-colors hover:border-primary">
                      <CardContent className="p-4">
                        <p className="font-medium">{page.title}</p>
                        {page.excerpt && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{page.excerpt}</p>
                        )}
                        <div className="flex gap-1 mt-2">
                          {page.tags.map((t) => (
                            <Badge key={t.tag.id} variant="secondary" className="text-[10px]">{t.tag.name}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
