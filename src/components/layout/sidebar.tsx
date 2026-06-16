"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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
  AlertTriangle,
  BarChart3,
} from "lucide-react"

export const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard, exact: true },
  { href: "/courses", label: "课程", icon: GraduationCap },
  { href: "/schedule", label: "学习排期", icon: CalendarClock },
  { href: "/notebooks", label: "笔记本", icon: BookOpen },
  { href: "/questions", label: "题库", icon: Library },
  { href: "/review", label: "复习", icon: Brain },
  { href: "/analysis", label: "薄弱分析", icon: AlertTriangle },
  { href: "/reports", label: "学习报告", icon: BarChart3 },
  { href: "/chat", label: "AI 对话", icon: MessageSquare },
  { href: "/graph", label: "知识图谱", icon: GitGraph },
  { href: "/goals", label: "学习目标", icon: Target },
  { href: "/search", label: "搜索", icon: Search },
]

export const bottomItems = [
  { href: "/settings", label: "设置", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-16 flex-col items-center bg-sidebar backdrop-blur-xl py-4 gap-1 shrink-0 border-r border-sidebar-border">
      {/* Logo — quiet forge mark */}
      <Tooltip>
        <TooltipTrigger render={
          <Link href="/" className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm transition-transform hover:scale-105 active:scale-95">
            MF
          </Link>
        } />
        <TooltipContent side="right">MindForge</TooltipContent>
      </Tooltip>

      {/* Navigation items */}
      {navItems.map((item) => {
        const isActive = (item as any).exact
          ? pathname === item.href
          : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"))
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger
              render={
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className="sr-only">{item.label}</span>
                </Link>
              }
            />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        )
      })}

      {/* Bottom items */}
      <div className="mt-auto flex flex-col gap-1">
        {bottomItems.map((item) => (
          <Tooltip key={item.href}>
            <TooltipTrigger
              render={
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={pathname === item.href ? 2.25 : 1.75} />
                  <span className="sr-only">{item.label}</span>
                </Link>
              }
            />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </aside>
  )
}
