import { NavLink } from "react-router-dom"

import { navigationItems } from "@/app/navigation"

export function AppSidebar() {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 flex-col bg-slate-950 text-white md:flex">
      <div className="border-b border-slate-800 px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight">ClayKeeper</h1>

        <p className="mt-1 text-sm text-slate-400">
          Shooting event management
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-4 py-3",
                  "text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-500 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                ].join(" ")
              }
            >
              <Icon className="h-5 w-5" />

              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <p className="text-xs text-slate-500">ClayKeeper v0.3.0</p>
      </div>
    </aside>
  )
}