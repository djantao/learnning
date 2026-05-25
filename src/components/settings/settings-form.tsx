"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X, GripVertical, Sparkles } from "lucide-react"
import { toast } from "sonner"

const TECH_TAGS = [
  "大数据", "前端", "后端", "AI/机器学习", "移动端",
  "运维/DevOps", "安全", "数据库", "Rust", "Go",
  "Python", "TypeScript", "Java", "C/C++", "云原生",
]

function toggleTag(text: string, tag: string): string {
  const parts = text.split(/[,，、]\s*/).map((s) => s.trim()).filter(Boolean)
  const idx = parts.findIndex((p) => p === tag)
  if (idx >= 0) {
    parts.splice(idx, 1)
  } else {
    parts.push(tag)
  }
  return parts.join("，")
}

function hasTag(text: string, tag: string): boolean {
  const parts = text.split(/[,，、]\s*/).map((s) => s.trim()).filter(Boolean)
  return parts.includes(tag)
}

interface Anchor {
  id?: string
  title: string
  instruction: string
  category: string
  priority: number
  isActive: boolean
}

interface Props {
  profile: {
    id: string
    learningGoals: string
    knowledgeLevel: string
    preferredStyle: string
    preferences: string
  } | null
  anchors: Anchor[]
  userId: string
}

export function SettingsForm({ profile, anchors: initialAnchors, userId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [anchors, setAnchors] = useState<Anchor[]>(
    initialAnchors.length > 0
      ? initialAnchors
      : [{ title: "", instruction: "", category: "general", priority: 0, isActive: true }]
  )
  const [learningGoals, setLearningGoals] = useState(profile?.learningGoals ?? "")
  const [knowledgeLevel, setKnowledgeLevel] = useState(profile?.knowledgeLevel ?? "")
  const [preferredStyle, setPreferredStyle] = useState(profile?.preferredStyle ?? "")
  const [language, setLanguage] = useState("zh-CN")
  const [detailLevel, setDetailLevel] = useState("deep")

  const prefs = (() => { try { return JSON.parse(profile?.preferences || "{}") } catch { return {} } })()
  const [smtpHost, setSmtpHost] = useState(prefs.smtpHost || "smtp.qq.com")
  const [smtpPort, setSmtpPort] = useState(prefs.smtpPort || "465")
  const [smtpUser, setSmtpUser] = useState(prefs.smtpUser || "")
  const [smtpPass, setSmtpPass] = useState(prefs.smtpPass || "")
  const [smtpTo, setSmtpTo] = useState(prefs.smtpTo || "")

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningGoals,
          knowledgeLevel,
          preferredStyle,
          preferences: JSON.stringify({ language, detailLevel, smtpHost, smtpPort, smtpUser, smtpPass, smtpTo }),
        }),
      })
      if (!res.ok) throw new Error("Failed to save profile")

      const anchorRes = await fetch("/api/anchors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchors }),
      })
      if (!anchorRes.ok) throw new Error("Failed to save anchors")

      toast.success("设置已保存")
      router.refresh()
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  function addAnchor() {
    setAnchors([...anchors, { title: "", instruction: "", category: "general", priority: anchors.length, isActive: true }])
  }

  function removeAnchor(index: number) {
    setAnchors(anchors.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {/* Learning Profile */}
      <Card>
        <CardHeader>
          <CardTitle>学习档案</CardTitle>
          <CardDescription>告诉 AI 你的学习目标、水平和偏好，它会在每次对话中记住这些信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="learningGoals">学习目标</Label>
            <Textarea
              id="learningGoals"
              placeholder="例如：我想系统学习 Rust 系统编程，目标是用 Rust 写出生产级的后端服务"
              value={learningGoals}
              onChange={(e) => setLearningGoals(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="knowledgeLevel">当前知识水平</Label>
            <Input
              id="knowledgeLevel"
              placeholder="例如：Rust 入门水平，TypeScript 专家，熟悉 Linux"
              value={knowledgeLevel}
              onChange={(e) => setKnowledgeLevel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              快速添加技术栈
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {TECH_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setKnowledgeLevel(toggleTag(knowledgeLevel, tag))}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    hasTag(knowledgeLevel, tag)
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {tag}{hasTag(knowledgeLevel, tag) ? " ✓" : " +"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredStyle">偏好讲解风格</Label>
            <Input
              id="preferredStyle"
              placeholder="例如：用生活中的类比来解释抽象概念，先给结论再展开细节，每个概念附代码示例"
              value={preferredStyle}
              onChange={(e) => setPreferredStyle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>语言偏好</Label>
              <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="mixed">中英混合</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>深度偏好</Label>
              <Select value={detailLevel} onValueChange={(v) => v && setDetailLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deep">深入讲解</SelectItem>
                  <SelectItem value="medium">适中</SelectItem>
                  <SelectItem value="shallow">简洁概括</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instruction Anchors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>指令锚点</CardTitle>
            <CardDescription>设定 AI 永远不会忘记的永久指令。每条指令会自动注入到每次 AI 对话中</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addAnchor}>
            <Plus className="mr-1 h-4 w-4" />
            添加
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {anchors.map((anchor, index) => (
            <div key={index} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs">
                    {anchor.category === "language" ? "语言" :
                     anchor.category === "format" ? "格式" :
                     anchor.category === "depth" ? "深度" : "通用"}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAnchor(index)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">标题</Label>
                  <Input
                    placeholder="例如：用中文解释"
                    value={anchor.title}
                    onChange={(e) => {
                      const updated = [...anchors]
                      updated[index] = { ...updated[index], title: e.target.value }
                      setAnchors(updated as Anchor[])
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">分类</Label>
                  <Select
                    value={anchor.category}
                    onValueChange={(v) => {
                      const updated = [...anchors]
                      updated[index] = { ...updated[index], category: v || "general" }
                      setAnchors(updated as Anchor[])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="language">语言</SelectItem>
                      <SelectItem value="format">格式</SelectItem>
                      <SelectItem value="depth">深度</SelectItem>
                      <SelectItem value="general">通用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">指令内容</Label>
                <Textarea
                  placeholder="例如：除非我明确要求，否则始终用中文回复。涉及英文术语时，首次出现请附中文解释。"
                  value={anchor.instruction}
                  onChange={(e) => {
                    const updated = [...anchors]
                    updated[index] = { ...updated[index], instruction: e.target.value }
                    setAnchors(updated as Anchor[])
                  }}
                  rows={2}
                />
              </div>
            </div>
          ))}
          {anchors.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              还没有指令锚点，点击「添加」来创建第一条
            </p>
          )}
        </CardContent>
      </Card>

      {/* Email Notification */}
      <Card>
        <CardHeader>
          <CardTitle>邮件通知</CardTitle>
          <CardDescription>配置 SMTP 发件服务器，学习项目延期时自动发送邮件提醒</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP 服务器</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.qq.com" />
            </div>
            <div className="space-y-2">
              <Label>端口</Label>
              <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="465" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>发件邮箱</Label>
            <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your@qq.com" />
          </div>
          <div className="space-y-2">
            <Label>SMTP 授权码</Label>
            <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="QQ邮箱设置里生成的授权码" />
          </div>
          <div className="space-y-2">
            <Label>收件邮箱</Label>
            <Input value={smtpTo} onChange={(e) => setSmtpTo(e.target.value)} placeholder="提醒邮件发到哪个邮箱" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  )
}
