import { NavLink } from "react-router-dom"

import { navigationSections } from "@/app/navigation"
import { useOrganization } from "@/features/organization/OrganizationProvider"
import { APP_VERSION, CLAYKEEPER_LOGO, useBrandSettings } from "@/lib/branding"
import { hasCapability } from "@/lib/permissions"

type AppSidebarProps = {
  mobile?: boolean
  onNavigate?: () => void
}

export function AppSidebar({
  mobile = false,
  onNavigate,
}: AppSidebarProps = {}) {
  const brand = useBrandSettings()
  const {
    organizationId,
    role,
    memberships,
    loading: organizationLoading,
    switching,
    switchOrganization,
  } = useOrganization()

  async function handleOrganizationChange(
    nextOrganizationId: string,
  ) {
    if (
      !nextOrganizationId ||
      nextOrganizationId === organizationId
    ) {
      return
    }

    try {
      await switchOrganization(nextOrganizationId)

      // Existing feature pages often resolve organization context
      // independently during initial load. Reloading after a deliberate
      // organization switch guarantees every scoped page starts fresh
      // against the newly selected organization.
      window.location.reload()
    } catch {
      // OrganizationProvider exposes the switch error through context.
      // Keep the current organization active if switching fails.
    }
  }

  const visibleSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          organizationLoading ||
          !item.capability ||
          hasCapability(role, item.capability),
      ),
    }))
    .filter((section) => section.items.length > 0)

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
        {visibleSections.map((section, sectionIndex) => (
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
        {memberships.length > 1 ? (
          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Organization
            </span>
            <select
              value={organizationId ?? ""}
              onChange={(event) =>
                void handleOrganizationChange(event.target.value)
              }
              disabled={organizationLoading || switching}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-medium text-slate-200 outline-none transition focus:border-emerald-500 disabled:cursor-wait disabled:opacity-60"
            >
              {memberships.map((membership) => (
                <option
                  key={membership.organizationId}
                  value={membership.organizationId}
                >
                  {membership.organizationName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
