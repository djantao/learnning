"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { BookOpen, Plus, FolderOpen, FileText, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Page {
  id: string; title: string; slug: string; updatedAt: string; excerpt: string | null
}

interface Section {
  id: string; name: string; pages: Page[]
}

interface Notebook {
  id: string; name: string; description: string | null; icon: string; color: string; sections: Section[]
}

export function NotebookList({ initialNotebooks }: { initialNotebooks: Notebook[] }) {
  const router = useRouter()
  const [notebooks, setNotebooks] = useState(initialNotebooks)
  const [newName, setNewName] = useState("")
  const [newSectionName, setNewSectionName] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)

  async function createNotebook() {
    if (!newName.trim()) return
    const res = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    })
    if (res.ok) {
      const nb = await res.json()
      setNotebooks([...notebooks, { ...nb, sections: [] }])
      setNewName("")
      setOpen(false)
      toast.success("笔记本已创建")
    }
  }

  async function createSection(notebookId: string) {
    const name = newSectionName[notebookId]
    if (!name?.trim()) return
    const res = await fetch(`/api/notebooks/${notebookId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const section = await res.json()
      setNotebooks(notebooks.map((nb) =>
        nb.id === notebookId ? { ...nb, sections: [...nb.sections, { ...section, pages: [] }] } : nb
      ))
      setNewSectionName({ ...newSectionName, [notebookId]: "" })
      toast.success("章节已创建")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">笔记本</h2>
          <p className="text-muted-foreground">管理你的知识库</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新建笔记本
            </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建笔记本</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                placeholder="笔记本名称..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createNotebook()}
              />
              <Button onClick={createNotebook} className="w-full">
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {notebooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">还没有笔记本</h3>
            <p className="mt-1 text-sm text-muted-foreground">创建你的第一个笔记本来开始组织知识</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((nb) => (
            <Card key={nb.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span>{nb.icon}</span>
                    {nb.name}
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/notes/new`)}>
                        <Plus className="mr-2 h-4 w-4" />
                        添加笔记
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {nb.description && <CardDescription>{nb.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                {nb.sections.map((section) => (
                  <div key={section.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      {section.name}
                    </div>
                    {section.pages.map((page) => (
                      <Link
                        key={page.id}
                        href={`/notes/${page.id}`}
                        className="flex items-center gap-2 pl-5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </Link>
                    ))}
                  </div>
                ))}
                {/* Add section */}
                <div className="flex gap-2 pt-2">
                  <Input
                    placeholder="新章节名..."
                    className="h-8 text-xs"
                    value={newSectionName[nb.id] || ""}
                    onChange={(e) => setNewSectionName({ ...newSectionName, [nb.id]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && createSection(nb.id)}
                  />
                  <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={() => createSection(nb.id)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
