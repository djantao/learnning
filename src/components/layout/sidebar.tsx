"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  MessageSquare,
  GitGraph,
  Target,
  Search,
  Settings,
  GraduationCap,
  Library,
  CalendarClock,
} from "lucide-react"

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/courses", label: "课程", icon: GraduationCap },
  { href: "/schedule", label: "学习排期", icon: CalendarClock },
  { href: "/notebooks", label: "笔记本", icon: BookOpen },
  { href: "/questions", label: "题库", icon: Library },
  { href: "/review", label: "复习", icon: Brain },
  { href: "/chat", label: "AI 对话", icon: MessageSquare },
  { href: "/graph", label: "知识图谱", icon: GitGraph },
  { href: "/goals", label: "学习目标", icon: Target },
  { href: "/search", label: "搜索", icon: Search },
]

const bottomItems = [
  { href: "/settings", label: "设置", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-16 flex-col items-center border-r bg-card py-4 gap-1 shrink-0">
      <Link href="/" className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
        MF
      </Link>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            pathname === item.href
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-5 w-5" />
          <span className="sr-only">{item.label}</span>
        </Link>
      ))}
      <div className="mt-auto flex flex-col gap-1">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="sr-only">{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  )
}
