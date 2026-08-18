import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { useOrganization } from "@/features/organization/OrganizationProvider"

type OrganizationHomeRouteProps = {
  children: ReactNode
}

export function OrganizationHomeRoute({
  children,
}: OrganizationHomeRouteProps) {
  const {
    role,
    loading,
    error,
  } = useOrganization()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />

          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading ClayKeeper...
          </p>
        </div>
      </div>
    )
  }

  if (!error && role === "member") {
    return <Navigate to="/my-profile" replace />
  }

  return <>{children}</>
}
