import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type StaffAccessRequestRole =
  | "admin"
  | "coach"
  | "scorekeeper"
  | "volunteer"

export type ApprovedStaffRole =
  | "admin"
  | "coach"
  | "scorekeeper"
  | "member"

export type StaffAccessRequest = {
  id: string
  organizationId: string
  userId: string
  requestedRole: StaffAccessRequestRole
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  message: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export type StaffAccessRequestApprover = {
  userId: string
  email: string
  role: "admin"
  isReviewer: boolean
}

export type StaffAccessRequestReviewResult = {
  requests: StaffAccessRequest[]
  role: string
  canReview: boolean
  canManageReviewers: boolean
  approvers: StaffAccessRequestApprover[]
}

function mapRequest(row: Record<string, unknown>): StaffAccessRequest {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    requestedRole: String(
      row.requested_role,
    ) as StaffAccessRequestRole,
    firstName: String(row.first_name || ""),
    lastName: String(row.last_name || ""),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    message: row.message ? String(row.message) : null,
    status: String(row.status || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  }
}

export function defaultApprovedRole(
  requestedRole: StaffAccessRequestRole,
): ApprovedStaffRole {
  return requestedRole === "volunteer"
    ? "member"
    : requestedRole
}

export async function loadStaffAccessRequests(): Promise<StaffAccessRequestReviewResult> {
  const context = await getCurrentOrganizationContext()

  if (context.role !== "owner" && context.role !== "admin") {
    throw new Error(
      "Only an owner or administrator can review staff access requests.",
    )
  }

  const { data: approverData, error: approverError } =
    await supabase.rpc("list_staff_access_request_reviewers", {
      p_organization_id: context.organizationId,
    })

  if (approverError) throw approverError

  const approvers = ((approverData ?? []) as Record<string, unknown>[])
    .map((row): StaffAccessRequestApprover => ({
      userId: String(row.user_id),
      email: String(row.email || ""),
      role: "admin",
      isReviewer: Boolean(row.is_reviewer),
    }))

  const canManageReviewers = context.role === "owner"
  const canReview =
    context.role === "owner" ||
    approvers.some(
      (approver) =>
        approver.userId === context.userId && approver.isReviewer,
    )

  if (!canReview) {
    return {
      requests: [],
      role: context.role,
      canReview,
      canManageReviewers,
      approvers,
    }
  }

  const { data, error } = await supabase
    .from("organization_access_requests")
    .select(
      "id, organization_id, user_id, requested_role, first_name, last_name, email, phone, message, status, created_at, updated_at",
    )
    .eq("organization_id", context.organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  if (error) throw error

  return {
    requests: ((data ?? []) as Record<string, unknown>[]).map(mapRequest),
    role: context.role,
    canReview,
    canManageReviewers,
    approvers,
  }
}

export async function setStaffAccessRequestApprover(
  userId: string,
  enabled: boolean,
): Promise<StaffAccessRequestApprover[]> {
  const context = await getCurrentOrganizationContext()

  if (context.role !== "owner") {
    throw new Error(
      "Only an organization owner can manage staff request approvers.",
    )
  }

  const { error } = await supabase.rpc(
    "set_staff_access_request_reviewer",
    {
      p_organization_id: context.organizationId,
      p_user_id: userId,
      p_enabled: enabled,
    },
  )

  if (error) throw error

  const { data, error: loadError } = await supabase.rpc(
    "list_staff_access_request_reviewers",
    {
      p_organization_id: context.organizationId,
    },
  )

  if (loadError) throw loadError

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    userId: String(row.user_id),
    email: String(row.email || ""),
    role: "admin",
    isReviewer: Boolean(row.is_reviewer),
  }))
}

export async function approveStaffAccessRequest(
  requestId: string,
  approvedRole: ApprovedStaffRole,
) {
  const { data, error } = await supabase.rpc(
    "approve_organization_access_request",
    {
      p_request_id: requestId,
      p_approved_role: approvedRole,
    },
  )

  if (error) throw error

  return data
}

export async function declineStaffAccessRequest(
  requestId: string,
) {
  const { data, error } = await supabase.rpc(
    "decline_organization_access_request",
    {
      p_request_id: requestId,
    },
  )

  if (error) throw error

  return data
}
