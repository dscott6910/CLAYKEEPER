import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"

import { useOrganization } from "@/features/organization/OrganizationProvider"
import { getCurrentParticipantId } from "@/lib/services/memberHome"

export function ParticipantHomePage() {
  const { role, loading: organizationLoading } = useOrganization()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      if (organizationLoading) return

      if (role !== "member") {
        if (mounted) setLoading(false)
        return
      }

      try {
        const id = await getCurrentParticipantId()

        if (!mounted) return

        setParticipantId(id)

        if (!id) {
          setError(
            "Your account is not linked to a participant profile.",
          )
        }
      } catch (nextError) {
        if (!mounted) return

        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to load your participant profile.",
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [organizationLoading, role])

  if (organizationLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading your participant dashboard...
          </p>
        </div>
      </div>
    )
  }

  if (role !== "member") {
    return <Navigate to="/" replace />
  }

  if (participantId) {
    return (
      <Navigate
        to={`/participants/${participantId}`}
        replace
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-bold text-red-900">
          Participant profile unavailable
        </h1>

        <p className="mt-2 text-sm text-red-700">
          {error}
        </p>
      </div>
    </div>
  )
}
