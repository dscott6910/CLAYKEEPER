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

export type StaffAccessRequestReviewResult = {
  requests: StaffAccessRequest[]
  role: string
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
  }
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
