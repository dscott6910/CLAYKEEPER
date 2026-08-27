import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Check,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UserPlus,
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
  setStaffAccessRequestApprover,
  type ApprovedStaffRole,
  type StaffAccessRequestApprover,
  type StaffAccessRequest,
} from "@/lib/services/staffAccessRequests"

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (error && typeof error === "object") {
    const fields = error as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
    }
    const parts = [
      fields.message,
      fields.details,
      fields.hint,
      fields.code ? `Code: ${fields.code}` : null,
    ]
      .filter((part): part is string => {
        return typeof part === "string" && part.trim().length > 0
      })
      .map((part) => part.trim())

    if (parts.length > 0) {
      return parts.join(" ")
    }
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
  const [success, setSuccess] = useState("")
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [savingApproverId, setSavingApproverId] =
    useState<string | null>(null)
  const [selectedApproverId, setSelectedApproverId] = useState("")
  const [canManageReviewers, setCanManageReviewers] = useState(false)
  const [canReview, setCanReview] = useState(false)
  const [approvers, setApprovers] = useState<
    StaffAccessRequestApprover[]
  >([])
  const [approvedRoles, setApprovedRoles] = useState<
    Record<string, ApprovedStaffRole>
  >({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const result = await loadStaffAccessRequests()
      setRequests(result.requests)
      setRole(result.role)
      setCanReview(result.canReview)
      setCanManageReviewers(result.canManageReviewers)
      setApprovers(result.approvers)
      setSelectedApproverId("")
      setApprovedRoles(
        Object.fromEntries(
          result.requests.map((request) => [
            request.id,
            defaultApprovedRole(request.requestedRole),
          ]),
        ),
      )
    } catch (caught) {
      setRequests([])
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pendingCount = requests.length
  const selectedApprovers = approvers.filter(
    (approver) => approver.isReviewer,
  )
  const availableApprovers = approvers.filter(
    (approver) => !approver.isReviewer,
  )

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

    setError("")
    setSuccess("")
    setReviewingId(request.id)

    try {
      await approveStaffAccessRequest(request.id, approvedRole)
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      )
      setSuccess(
        `${request.firstName} ${request.lastName} was approved as ${roleLabel(approvedRole)}.`,
      )
      toast.success(
        `${request.firstName} ${request.lastName} was approved as ${roleLabel(approvedRole)}.`,
      )
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      toast.error(message)
    } finally {
      setReviewingId(null)
    }
  }

  async function handleDecline(request: StaffAccessRequest) {
    setError("")
    setSuccess("")
    setReviewingId(request.id)

    try {
      await declineStaffAccessRequest(request.id)
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      )
      setSuccess(
        `${request.firstName} ${request.lastName} was declined.`,
      )
      toast.success(
        `${request.firstName} ${request.lastName} was declined.`,
      )
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      toast.error(message)
    } finally {
      setReviewingId(null)
    }
  }

  async function updateApprover(userId: string, enabled: boolean) {
    setError("")
    setSuccess("")
    setSavingApproverId(userId)

    try {
      const updatedApprovers =
        await setStaffAccessRequestApprover(userId, enabled)
      const approver = updatedApprovers.find(
        (item) => item.userId === userId,
      )
      setApprovers(updatedApprovers)
      setSelectedApproverId("")
      setSuccess(
        enabled
          ? `${approver?.email || "Admin"} can now approve staff requests.`
          : `${approver?.email || "Admin"} was removed from staff request approvers.`,
      )
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      toast.error(message)
    } finally {
      setSavingApproverId(null)
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

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Staff request approvers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Owners always approve requests. Selected admins can
                approve or decline pending staff access.
              </p>
            </div>

            {canManageReviewers ? (
              <div className="grid gap-2 sm:grid-cols-[minmax(220px,320px)_auto]">
                <select
                  value={selectedApproverId}
                  onChange={(event) =>
                    setSelectedApproverId(event.target.value)
                  }
                  disabled={
                    loading ||
                    savingApproverId !== null ||
                    availableApprovers.length === 0
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                >
                  <option value="">
                    {availableApprovers.length === 0
                      ? "No admins available"
                      : "Select an admin"}
                  </option>
                  {availableApprovers.map((approver) => (
                    <option
                      key={approver.userId}
                      value={approver.userId}
                    >
                      {approver.email || approver.userId}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    void updateApprover(selectedApproverId, true)
                  }
                  disabled={
                    !selectedApproverId ||
                    loading ||
                    savingApproverId !== null
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Add approver
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {selectedApprovers.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                No admin approvers are selected.
              </div>
            ) : (
              selectedApprovers.map((approver) => (
                <div
                  key={approver.userId}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {approver.email || approver.userId}
                    </p>
                    <p className="text-xs uppercase text-slate-500">
                      Admin approver
                    </p>
                  </div>

                  {canManageReviewers ? (
                    <button
                      type="button"
                      onClick={() =>
                        void updateApprover(approver.userId, false)
                      }
                      disabled={savingApproverId !== null}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        {!canReview && !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Your role is <strong>{role || "unknown"}</strong>.
            Only organization owners and selected admin approvers can
            review staff access requests.
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
                const disabled = reviewingId !== null

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
