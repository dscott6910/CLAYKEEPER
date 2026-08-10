import { Navigate, Outlet } from "react-router-dom"

import { useOrganization } from "@/features/organization/OrganizationProvider"
import {
  hasCapability,
  type OrganizationCapability,
} from "@/lib/permissions"

type CapabilityRouteProps = {
  capability: OrganizationCapability
}

export function CapabilityRoute({
  capability,
}: CapabilityRouteProps) {
  const { role, loading, error } = useOrganization()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Checking organization access...
          </p>
        </div>
      </div>
    )
  }

  if (error || !hasCapability(role, capability)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
