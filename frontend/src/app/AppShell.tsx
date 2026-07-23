import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/app/AppSidebar"
import { GlobalSearch } from "@/components/system/GlobalSearch"

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-950">
      <AppSidebar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
      <GlobalSearch />
    </div>
  )
}
