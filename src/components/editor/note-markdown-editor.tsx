"use client"

import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { renderMarkdown } from "@/lib/markdown"

interface Props {
  content: string
  onChange: (content: string) => void
}

export function NoteMarkdownEditor({ content, onChange }: Props) {
  return (
    <Tabs defaultValue="write">
      <TabsList>
        <TabsTrigger value="write">编辑</TabsTrigger>
        <TabsTrigger value="preview">预览</TabsTrigger>
      </TabsList>
      <TabsContent value="write">
        <Textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="开始写笔记... 支持 Markdown 语法。使用 [[笔记名]] 创建双向链接。"
          className="min-h-[500px] font-mono text-sm resize-y"
        />
      </TabsContent>
      <TabsContent value="preview">
        <Card className="min-h-[500px]">
          <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
