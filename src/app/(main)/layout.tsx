import { Sidebar } from "@/components/layout/sidebar"
import { Navbar } from "@/components/layout/navbar"
import { MobileTabBar } from "@/components/layout/mobile-tab-bar"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-5 md:p-8 pb-[calc(1.5rem+3.25rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  )
}
