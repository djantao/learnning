"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, BellDot, BookOpen, Award, Calendar, Sparkles, AlertTriangle } from "lucide-react"

interface Reminder {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  createdAt: string
}

const typeIcons: Record<string, React.ReactNode> = {
  review: <Calendar className="h-3.5 w-3.5 text-amber-500" />,
  study: <BookOpen className="h-3.5 w-3.5 text-blue-500" />,
  achievement: <Award className="h-3.5 w-3.5 text-green-500" />,
  schedule_overdue: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  deadline_warning: <Calendar className="h-3.5 w-3.5 text-orange-500" />,
  system: <Sparkles className="h-3.5 w-3.5 text-purple-500" />,
}

export function ReminderBell() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/reminders")
        if (res.ok) {
          const data = await res.json()
          setReminders(data.reminders || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch { /* ignore */ }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  async function handleClick(reminder: Reminder) {
    try {
      await fetch(`/api/reminders/${reminder.id}`, { method: "PATCH" })
    } catch { /* ignore */ }
    setReminders((prev) => prev.filter((r) => r.id !== reminder.id))
    setUnreadCount((c) => Math.max(0, c - 1))
    if (reminder.link) router.push(reminder.link)
  }

  async function markAllRead() {
    for (const r of reminders) {
      try { await fetch(`/api/reminders/${r.id}`, { method: "PATCH" }) } catch { /* ignore */ }
    }
    setReminders([])
    setUnreadCount(0)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted transition-colors">
        {unreadCount > 0 ? (
          <BellDot className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" />
        )}
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">通知</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
              全部已读
            </button>
          )}
        </div>
        {reminders.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
            暂无通知
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            {reminders.map((r) => (
              <DropdownMenuItem
                key={r.id}
                onClick={() => handleClick(r)}
                className="flex items-start gap-3 px-3 py-3 cursor-pointer"
              >
                <span className="mt-0.5 shrink-0">{typeIcons[r.type] || typeIcons.system}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.message}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
