"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, GraduationCap, Brain, MessageSquare, Ellipsis } from "lucide-react"

const tabs = [
  { href: "/", label: "首页", icon: LayoutDashboard, exact: true },
  { href: "/courses", label: "课程", icon: GraduationCap },
  { href: "/review", label: "复习", icon: Brain },
  { href: "/chat", label: "AI", icon: MessageSquare },
]

export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-card/90 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom,0px)] h-[calc(3.25rem+env(safe-area-inset-bottom,0px))]">
      {tabs.map((tab) => {
        const isActive = (tab as any).exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + "/")
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <tab.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        )
      })}
      <button
        onClick={() => { document.getElementById("mobile-menu-btn")?.click() }}
        className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 text-muted-foreground"
      >
        <Ellipsis className="h-6 w-6" strokeWidth={2} />
        <span className="text-[10px] font-medium">更多</span>
      </button>
    </nav>
  )
}
