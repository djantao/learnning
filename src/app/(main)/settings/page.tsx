import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { SettingsForm } from "@/components/settings/settings-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const [profile, anchors] = await Promise.all([
    prisma.learningProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.instructionAnchor.findMany({ where: { userId: session.user.id }, orderBy: { priority: "desc" } }),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">设置</h2>
        <p className="text-muted-foreground">管理你的学习档案和 AI 指令锚点</p>
      </div>

      <SettingsForm profile={profile} anchors={anchors} userId={session.user.id} />
    </div>
  )
}
