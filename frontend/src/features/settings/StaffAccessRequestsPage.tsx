import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Check,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  approveStaffAccessRequest,
  defaultApprovedRole,
  declineStaffAccessRequest,
  loadStaffAccessRequests,
  type ApprovedStaffRole,
  type StaffAccessRequest,
} from "@/lib/services/staffAccessRequests"

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return "Unable to load staff access requests."
}

function formatDate(value: string) {
  if (!value) return "Unknown"

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString()
}

function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Admin"
    case "coach":
      return "Coach"
    case "scorekeeper":
      return "Scorekeeper"
    case "volunteer":
      return "Volunteer"
    case "member":
      return "Member"
    default:
      return role || "Member"
  }
}

export function StaffAccessRequestsPage() {
  const [requests, setRequests] = useState<StaffAccessRequest[]>([])
  const [role, setRole] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [approvedRoles, setApprovedRoles] = useState<
    Record<string, ApprovedStaffRole>
  >({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const result = await loadStaffAccessRequests()
      setRequests(result.requests)
      setRole(result.role)
      setApprovedRoles(
        Object.fromEntries(
          result.requests.map((request) => [
            request.id,
            defaultApprovedRole(request.requestedRole),
          ]),
        ),
      )
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pendingCount = requests.length
  const canReview = role === "owner" || role === "admin"

  const requestedSummary = useMemo(() => {
    const counts = new Map<string, number>()

    for (const request of requests) {
      counts.set(
        request.requestedRole,
        (counts.get(request.requestedRole) ?? 0) + 1,
      )
    }

    return Array.from(counts.entries())
      .map(([nextRole, count]) => `${count} ${roleLabel(nextRole)}`)
      .join(", ")
  }, [requests])

  async function handleApprove(request: StaffAccessRequest) {
    const approvedRole =
      approvedRoles[request.id] ??
      defaultApprovedRole(request.requestedRole)

    setReviewingId(request.id)

    try {
      await approveStaffAccessRequest(request.id, approvedRole)
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      )
      toast.success(
        `${request.firstName} ${request.lastName} was approved as ${roleLabel(approvedRole)}.`,
      )
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setReviewingId(null)
    }
  }

  async function handleDecline(request: StaffAccessRequest) {
    setReviewingId(request.id)

    try {
      await declineStaffAccessRequest(request.id)
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      )
      toast.success(
        `${request.firstName} ${request.lastName} was declined.`,
      )
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Staff Access Requests"
        description="Approve coach, scorekeeper, admin, and volunteer account requests"
      />

      <PageContainer className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Pending requests
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
            <p className="text-sm font-medium text-slate-500">
              Requested roles
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {requestedSummary || "No pending role requests"}
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Review queue
              </p>
              <p className="text-sm text-slate-500">
                Approved users receive organization access immediately.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || reviewingId !== null}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!canReview && !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Your role is <strong>{role || "unknown"}</strong>.
            Only organization owners and administrators can review
            staff access requests.
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading staff access requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center">
              <UserCheck className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-3 text-base font-semibold text-slate-900">
                No pending staff requests
              </p>
              <p className="mt-1 text-sm text-slate-500">
                New admin, coach, scorekeeper, and volunteer requests
                will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {requests.map((request) => {
                const fullName =
                  `${request.firstName} ${request.lastName}`.trim()
                const busy = reviewingId === request.id
                const disabled = reviewingId !== null || !canReview

                return (
                  <article key={request.id} className="p-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-950">
                            {fullName || "Unnamed requester"}
                          </h2>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            {roleLabel(request.requestedRole)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                          {request.email ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="h-4 w-4 text-slate-400" />
                              {request.email}
                            </span>
                          ) : null}

                          {request.phone ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-4 w-4 text-slate-400" />
                              {request.phone}
                            </span>
                          ) : null}
                        </div>

                        {request.message ? (
                          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                            {request.message}
                          </p>
                        ) : null}

                        <p className="mt-3 text-xs text-slate-500">
                          Requested {formatDate(request.createdAt)}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[minmax(180px,220px)_auto_auto] sm:items-end">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase text-slate-500">
                            Approve as
                          </span>
                          <select
                            value={
                              approvedRoles[request.id] ??
                              defaultApprovedRole(request.requestedRole)
                            }
                            onChange={(event) =>
                              setApprovedRoles((current) => ({
                                ...current,
                                [request.id]: event.target
                                  .value as ApprovedStaffRole,
                              }))
                            }
                            disabled={disabled}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                          >
                            <option value="admin">Admin</option>
                            <option value="coach">Coach</option>
                            <option value="scorekeeper">
                              Scorekeeper
                            </option>
                            <option value="member">
                              Member / volunteer
                            </option>
                          </select>
                        </label>

                        <button
                          type="button"
                          onClick={() => void handleApprove(request)}
                          disabled={disabled}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          {busy ? "Approving..." : "Approve"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDecline(request)}
                          disabled={disabled}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
