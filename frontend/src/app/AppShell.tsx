import { useEffect, useMemo, useState } from "react"
import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/app/AppSidebar"
import {
  MobileNavigationContext,
} from "@/app/MobileNavigationContext"
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
    return () => document.removeEventListener("keydown", handleKeyDown)
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

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>

        <GlobalSearch />
      </div>
    </MobileNavigationContext.Provider>
  )
}
