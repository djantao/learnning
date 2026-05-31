"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Clock } from "lucide-react"

interface ResumeButtonProps {
  courseId: string
  courseTitle: string
  courseIcon: string
  courseColor: string
  kpId: string
  kpTitle: string
  moduleId: string
  updatedAt: string | null
}

export function ResumeButton({
  courseId,
  courseTitle,
  courseIcon,
  kpId,
  kpTitle,
  moduleId,
  updatedAt,
}: ResumeButtonProps) {
  const router = useRouter()

  const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return ""
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "刚刚"
    if (mins < 60) return `${mins} 分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    return `${days} 天前`
  }

  return (
    <Button
      variant="default"
      size="lg"
      className="w-full justify-start gap-3 h-auto py-4 px-5"
      onClick={() => router.push(`/courses/${courseId}/learn/${kpId}`)}
    >
      <span className="text-2xl">{courseIcon}</span>
      <div className="flex-1 text-left min-w-0">
        <div className="font-semibold truncate">{kpTitle}</div>
        <div className="text-xs text-muted-foreground truncate">
          {courseTitle}
          {updatedAt && (
            <span className="inline-flex items-center gap-1 ml-2">
              <Clock className="w-3 h-3" />
              {timeAgo(updatedAt)}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="w-5 h-5 shrink-0" />
    </Button>
  )
}

interface ResumeBannerProps {
  courseId: string
  kpId: string
  kpTitle: string
}

export function ResumeBanner({ courseId, kpId, kpTitle }: ResumeBannerProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">上次学到</div>
        <div className="font-medium truncate">{kpTitle}</div>
      </div>
      <Button
        size="sm"
        onClick={() => router.push(`/courses/${courseId}/learn/${kpId}`)}
      >
        继续学习
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  )
}
