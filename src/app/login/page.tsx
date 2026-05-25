import { auth, signIn } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/")

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">MindForge</CardTitle>
          <CardDescription>登录你的知识管理空间</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server"
              await signIn("credentials", {
                email: formData.get("email") as string,
                password: formData.get("password") as string,
                redirectTo: "/",
              })
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" placeholder="your@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" required placeholder="任意密码（原型阶段）" />
            </div>
            <Button type="submit" className="w-full">
              登录 / 注册
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            原型阶段：输入任意邮箱即可自动创建账号
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
