import { Bell, CalendarDays, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"

type AppHeaderProps = {
  title: string
  description?: string
  seasonLabel?: string
}

export function AppHeader({
  title,
  description,
  seasonLabel,
}: AppHeaderProps) {
  return (
    <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-slate-950">
            {title}
          </h2>
          {description ? (
            <p className="truncate text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {seasonLabel ? (
          <button
            type="button"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm sm:flex"
          >
            <CalendarDays className="h-4 w-4" />
            {seasonLabel}
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Button>

        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            DS
          </div>
          <span className="text-sm font-semibold text-slate-800">Admin User</span>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </div>
      </div>
    </header>
  )
}
