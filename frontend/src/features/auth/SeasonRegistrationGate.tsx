import { useEffect, useState, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { useOrganization } from "@/features/organization/OrganizationProvider"
import { getParticipantSeasonRegistrationStatus } from "@/lib/services/participantSeasonRegistration"

type SeasonRegistrationGateProps = {
  children: ReactNode
}

export function SeasonRegistrationGate({
  children,
}: SeasonRegistrationGateProps) {
  const location = useLocation()
  const { organizationId, role, loading: organizationLoading } =
    useOrganization()

  const [checking, setChecking] = useState(false)
  const [registrationRequired, setRegistrationRequired] =
    useState(false)
  const [error, setError] = useState("")

  const isSeasonRegistrationRoute =
    location.pathname === "/season-registration"

  useEffect(() => {
    let mounted = true

    async function checkRegistration() {
      if (
        organizationLoading ||
        !organizationId ||
        role !== "member" ||
        isSeasonRegistrationRoute
      ) {
        setChecking(false)
        setRegistrationRequired(false)
        setError("")
        return
      }

      setChecking(true)
      setError("")

      try {
        const status =
          await getParticipantSeasonRegistrationStatus(organizationId)

        if (!mounted) return

        setRegistrationRequired(
          Boolean(status?.registrationRequired),
        )
      } catch (caught) {
        if (!mounted) return

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to check season registration.",
        )
        setRegistrationRequired(false)
      } finally {
        if (mounted) setChecking(false)
      }
    }

    void checkRegistration()

    return () => {
      mounted = false
    }
  }, [
    organizationId,
    role,
    organizationLoading,
    isSeasonRegistrationRoute,
  ])

  if (organizationLoading || checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />

          <p className="mt-4 text-sm font-medium text-slate-600">
            Checking season registration...
          </p>
        </div>
      </div>
    )
  }

  if (registrationRequired && !isSeasonRegistrationRoute) {
    return (
      <Navigate
        to="/season-registration"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (error) {
    return (
      <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <p className="font-semibold">
          Season registration check unavailable
        </p>

        <p className="mt-1">{error}</p>
      </div>
    )
  }

  return <>{children}</>
}
