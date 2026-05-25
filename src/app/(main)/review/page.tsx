"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, History, Play } from "lucide-react"
import { ReviewPlan } from "@/components/review/review-plan"
import Link from "next/link"

export default function ReviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">复习</h2>
        <p className="text-muted-foreground">间隔重复，巩固记忆</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/review/session">
          <Card className="cursor-pointer transition-colors hover:border-primary">
            <CardHeader>
              <Play className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">开始复习</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">复习到期闪卡</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/review/cards">
          <Card className="cursor-pointer transition-colors hover:border-primary">
            <CardHeader>
              <Brain className="h-8 w-8 text-blue-500" />
              <CardTitle className="text-lg">管理闪卡</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">浏览、创建和编辑你的闪卡</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/review/history">
          <Card className="cursor-pointer transition-colors hover:border-primary">
            <CardHeader>
              <History className="h-8 w-8 text-green-500" />
              <CardTitle className="text-lg">复习历史</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">查看复习记录和统计数据</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* AI Review Plan */}
      <ReviewPlan />
    </div>
  )
}
