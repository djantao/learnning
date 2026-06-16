"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"
import Link from "next/link"

interface NoteLink {
  targetPage?: { id: string; title: string; slug: string }
  sourcePage?: { id: string; title: string; slug: string }
}

interface Props {
  noteId: string
  linksFrom?: NoteLink[]
  linksTo?: NoteLink[]
}

export function NoteLinksPanel({ noteId, linksFrom, linksTo }: Props) {
  return (
    <Card id="links-sidebar">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">链接</h3>
        {linksFrom && linksFrom.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">出链</p>
            {linksFrom.map((link) => (
              <Link
                key={link.targetPage!.id}
                href={`/notes/${link.targetPage!.id}`}
                className="block text-sm text-primary hover:underline"
              >
                → {link.targetPage!.title}
              </Link>
            ))}
          </div>
        )}
        {linksTo && linksTo.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">反向链接</p>
            {linksTo.map((link) => (
              <Link
                key={link.sourcePage!.id}
                href={`/notes/${link.sourcePage!.id}`}
                className="block text-sm text-primary hover:underline"
              >
                ← {link.sourcePage!.title}
              </Link>
            ))}
          </div>
        )}
        {(!linksFrom?.length && !linksTo?.length) && (
          <p className="text-xs text-muted-foreground">暂无链接</p>
        )}
        <Link href={`/notes/${noteId}/graph`} className="block">
          <Button variant="ghost" size="sm" className="w-full">
            <ExternalLink className="mr-1 h-3 w-3" />
            查看知识图谱
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
