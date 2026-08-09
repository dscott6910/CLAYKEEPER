import { NavLink } from "react-router-dom"

import { navigationSections } from "@/app/navigation"
import { APP_VERSION, CLAYKEEPER_LOGO, useBrandSettings } from "@/lib/branding"

type AppSidebarProps = {
  mobile?: boolean
  onNavigate?: () => void
}

export function AppSidebar({
  mobile = false,
  onNavigate,
}: AppSidebarProps = {}) {
  const brand = useBrandSettings()

  return (
    <aside
      className={
        mobile
          ? "flex h-full min-h-screen w-64 shrink-0 flex-col bg-slate-950 text-white"
          : "hidden min-h-screen w-64 shrink-0 flex-col bg-slate-950 text-white md:flex"
      }
    >
      <div className="flex min-h-[190px] items-center justify-center border-b border-slate-200 bg-white px-4 py-3">
        <img
          src={CLAYKEEPER_LOGO}
          alt="ClayKeeper TMK"
          className="h-40 w-full object-contain"
        />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-4">
        {navigationSections.map((section, sectionIndex) => (
          <div key={section.label ?? `primary-${sectionIndex}`}>
            {section.label ? (
              <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {section.label}
              </p>
            ) : null}

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 rounded-lg px-4 py-2.5",
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
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-xs font-medium text-slate-300">
          {brand.organizationName}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          ClayKeeper v{APP_VERSION}
        </p>
      </div>
    </aside>
  )
}
