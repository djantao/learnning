"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { LogOut, Menu, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { navItems, bottomItems } from "./sidebar"
import { ReminderBell } from "./reminder-bell"

const pageTitles: Record<string, string> = {
  "/": "仪表盘",
  "/notebooks": "笔记本",
  "/review": "复习",
  "/chat": "AI 对话",
  "/graph": "知识图谱",
  "/goals": "学习目标",
  "/schedule": "学习排期",
  "/search": "搜索",
  "/settings": "设置",
}

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = Object.entries(pageTitles).find(([key]) => pathname === key || pathname.startsWith(key + "/"))?.[1] ?? "MindForge"

  return (
    <header className="flex h-12 sm:h-14 items-center justify-between bg-sidebar backdrop-blur-xl px-3 sm:px-4 md:px-6 shrink-0 border-b border-sidebar-border">
      <div className="flex items-center gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="打开菜单" id="mobile-menu-btn">
                <Menu className="h-5 w-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-64 p-0 bg-card/95 backdrop-blur-xl">
            <SheetHeader className="px-4 py-3 border-b border-border">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">MF</span>
                MindForge
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {navItems.map((item) => {
                const isActive = (item as any).exact
                  ? pathname === item.href
                  : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
              <div className="mt-auto pt-2 border-t border-border">
                {bottomItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      pathname === item.href
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <ReminderBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
