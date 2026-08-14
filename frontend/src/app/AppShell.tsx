import { useEffect, useMemo, useState } from "react"
import { Menu } from "lucide-react"
import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/app/AppSidebar"
import {
  MobileNavigationContext,
} from "@/app/MobileNavigationContext"
import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/system/GlobalSearch"

export function AppShell() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)

  const mobileNavigation = useMemo(
    () => ({
      openMobileNavigation: () => setMobileNavigationOpen(true),
      closeMobileNavigation: () => setMobileNavigationOpen(false),
    }),
    [],
  )

  useEffect(() => {
    if (!mobileNavigationOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [mobileNavigationOpen])

  useEffect(() => {
    if (!mobileNavigationOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileNavigationOpen])

  return (
    <MobileNavigationContext.Provider value={mobileNavigation}>
      <div className="flex min-h-screen bg-slate-100 text-slate-950">
        <AppSidebar />

        {mobileNavigationOpen ? (
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/60"
              aria-label="Close navigation"
              onClick={() => setMobileNavigationOpen(false)}
            />

            <div className="relative z-10 h-full w-64 max-w-[85vw]">
              <AppSidebar
                mobile
                onNavigate={() => setMobileNavigationOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-40 flex h-14 items-center border-b border-slate-200 bg-white px-3 shadow-sm md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <span className="ml-2 text-sm font-semibold text-slate-700">
              ClayKeeper
            </span>

            <div className="ml-auto">
              <GlobalSearch />
            </div>
          </div>

          <div className="hidden min-h-14 items-center justify-end border-b border-slate-200 bg-slate-50 px-6 md:flex">
            <GlobalSearch />
          </div>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </MobileNavigationContext.Provider>
  )
}
