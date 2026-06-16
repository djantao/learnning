"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { History, RotateCcw, Eye, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/lib/format-date"
import { renderMarkdown } from "@/lib/markdown"

interface VersionPreview {
  id: string
  version: number
  title: string
  wordCount: number
  changeSummary: string | null
  createdAt: string
}

interface VersionDetail extends VersionPreview {
  content: string
  contentPlain: string
}

interface Props {
  noteId: string
  onRestored?: () => void
}

export function NoteVersionHistory({ noteId, onRestored }: Props) {
  const [versions, setVersions] = useState<VersionPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<VersionDetail | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  const loadVersions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes/${noteId}/versions`)
      if (res.ok) {
        setVersions(await res.json())
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [noteId])

  useEffect(() => { loadVersions() }, [loadVersions])

  async function viewVersion(versionId: string) {
    setPreviewOpen(true)
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/notes/${noteId}/versions/${versionId}`)
      if (res.ok) {
        setPreviewVersion(await res.json())
      } else {
        toast.error("加载版本失败")
        setPreviewOpen(false)
      }
    } catch {
      toast.error("加载版本失败")
      setPreviewOpen(false)
    }
    setPreviewLoading(false)
  }

  async function restoreVersion(versionId: string) {
    if (!confirm("确定恢复到此版本？当前内容将被替换。")) return
    setRestoring(versionId)
    try {
      const res = await fetch(`/api/notes/${noteId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      })
      if (res.ok) {
        toast.success("已恢复到选中版本")
        onRestored?.()
      } else {
        toast.error("恢复失败")
      }
    } catch {
      toast.error("恢复失败")
    }
    setRestoring(null)
  }

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">版本历史</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无历史版本</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-md border px-2.5 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-muted-foreground">v{v.version}</span>
                      <span className="text-muted-foreground/60">{formatDate(v.createdAt)}</span>
                    </div>
                    <span className="text-muted-foreground">{v.wordCount} 字</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost" size="sm" className="h-6 px-1.5"
                      onClick={() => viewVersion(v.id)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-6 px-1.5"
                      onClick={() => restoreVersion(v.id)}
                      disabled={restoring === v.id}
                    >
                      {restoring === v.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {previewVersion && (
                <span>v{previewVersion.version} — {previewVersion.title}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewVersion ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatDate(previewVersion.createdAt)}</span>
                  <span>{previewVersion.wordCount} 字</span>
                </div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-4"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(previewVersion.content) }}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">版本内容为空</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>关闭</Button>
            {previewVersion && (
              <Button
                size="sm"
                onClick={() => { setPreviewOpen(false); restoreVersion(previewVersion.id) }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                恢复此版本
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
