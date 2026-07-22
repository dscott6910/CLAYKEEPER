import { Bell, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"

type AppHeaderProps = {
  title: string
  description?: string
}

export function AppHeader({
  title,
  description,
}: AppHeaderProps) {
  return (
    <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-slate-950">
            {title}
          </h2>

          {description ? (
            <p className="truncate text-sm text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
          DS
        </div>
      </div>
    </header>
  )
}