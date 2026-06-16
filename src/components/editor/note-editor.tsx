"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Save, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { NoteTitleInput } from "./note-title-input"
import { NoteTagInput } from "./note-tag-input"
import { NoteSectionSelector } from "./note-section-selector"
import { NoteMarkdownEditor } from "./note-markdown-editor"
import { NoteAiSidebar } from "./note-ai-sidebar"
import { NoteLinksPanel } from "./note-links-panel"
import { NoteVersionHistory } from "./note-version-history"

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

interface NoteLink {
  targetPage?: { id: string; title: string; slug: string }
  sourcePage?: { id: string; title: string; slug: string }
}

interface NoteData {
  id: string
  title: string
  content: string
  sectionId: string | null
  section?: { id: string; name: string; notebookId: string } | null
  tags: { tag: { id: string; name: string } }[]
  linksFrom?: NoteLink[]
  linksTo?: NoteLink[]
  slug?: string
}

interface Props {
  notebooks: Notebook[]
  initialNote?: NoteData | null
}

export function NoteEditor({ notebooks, initialNote }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialNote?.title ?? "")
  const [content, setContent] = useState(initialNote?.content ?? "")
  const [sectionId, setSectionId] = useState<string | null>(initialNote?.sectionId ?? null)
  const [tags, setTags] = useState<string[]>(initialNote?.tags?.map((t) => t.tag.name) ?? [])
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const isNew = !initialNote?.id

  const doSave = useCallback(async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const url = isNew ? "/api/notes" : `/api/notes/${initialNote!.id}`
      const method = isNew ? "POST" : "PUT"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, sectionId: sectionId || null, tags }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setLastSaved(new Date())
      if (isNew && data.id) {
        router.replace(`/notes/${data.id}`)
      }
      toast.success("已保存")
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }, [title, content, sectionId, tags, isNew, initialNote, router])

  // Auto-save: 3s debounce after content changes
  useEffect(() => {
    if (!initialNote) return
    const handler = setTimeout(() => {
      if (title !== initialNote.title || content !== initialNote.content) {
        doSave()
      }
    }, 3000)
    return () => clearTimeout(handler)
  }, [title, content, sectionId, tags])

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        doSave()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [doSave])

  function addTag(name: string) {
    setTags([...tags, name])
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name))
  }

  function scrollToLinks() {
    const linksSection = document.getElementById("links-sidebar")
    if (linksSection) {
      linksSection.scrollIntoView({ behavior: "smooth" })
      toast.info("查看右侧「链接」面板")
    } else {
      toast.info("暂无关联笔记")
    }
  }

  return (
    <div className="flex gap-6">
      {/* Main Editor */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/notebooks">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <NoteTitleInput value={title} onChange={setTitle} />
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-muted-foreground">
                已保存 {lastSaved.toLocaleTimeString("zh-CN")}
              </span>
            )}
            <Button size="sm" onClick={doSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>

        <NoteSectionSelector
          notebooks={notebooks}
          sectionId={sectionId}
          onChange={setSectionId}
        />

        <NoteTagInput
          tags={tags}
          onAdd={addTag}
          onRemove={removeTag}
        />

        <NoteMarkdownEditor content={content} onChange={setContent} />
      </div>

      {/* Right Sidebar */}
      <div className="hidden w-64 space-y-4 xl:block shrink-0">
        <NoteAiSidebar
          noteId={initialNote?.id ?? null}
          content={content}
          title={title}
          onLinksClick={scrollToLinks}
        />

        {initialNote?.id && (
          <NoteLinksPanel
            noteId={initialNote.id}
            linksFrom={initialNote.linksFrom}
            linksTo={initialNote.linksTo}
          />
        )}

        {initialNote?.id && (
          <NoteVersionHistory
            noteId={initialNote.id}
            onRestored={() => window.location.reload()}
          />
        )}
      </div>
    </div>
  )
}
