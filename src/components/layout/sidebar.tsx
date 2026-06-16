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
    <aside className="hidden lg:flex w-16 flex-col items-center bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-xl py-4 gap-1 shrink-0 shadow-[1px_0_0_0_rgba(0,0,0,0.04)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.04)]">
      <Tooltip>
        <TooltipTrigger render={<Link href="/" className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">MF</Link>} />
        <TooltipContent side="right">MindForge</TooltipContent>
      </Tooltip>
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
                    ? "bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#0A84FF]/15 dark:text-[#0A84FF]"
                    : "text-[#86868B] hover:bg-black/5 hover:text-[#1D1D1F] dark:text-[#98989D] dark:hover:bg-white/8 dark:hover:text-[#F5F5F7]"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
              </Link>
            }
          />
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
          )
        })}
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
                      ? "bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#0A84FF]/15 dark:text-[#0A84FF]"
                      : "text-[#86868B] hover:bg-black/5 hover:text-[#1D1D1F] dark:text-[#98989D] dark:hover:bg-white/8 dark:hover:text-[#F5F5F7]"
                  )}
                >
                  <item.icon className="h-5 w-5" />
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
