import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type RegistrationNotificationRecipient = {
  userId: string
  email: string
  role: "owner" | "admin"
  canReviewStaffRequests: boolean
  notifyStaffRequests: boolean
  notifyParticipantRegistrations: boolean
}

function mapRecipient(
  row: Record<string, unknown>,
): RegistrationNotificationRecipient {
  return {
    userId: String(row.user_id),
    email: String(row.email || ""),
    role: String(row.role) as "owner" | "admin",
    canReviewStaffRequests: Boolean(
      row.can_review_staff_requests,
    ),
    notifyStaffRequests: Boolean(row.notify_staff_requests),
    notifyParticipantRegistrations: Boolean(
      row.notify_participant_registrations,
    ),
  }
}

async function listRecipients(
  organizationId: string,
): Promise<RegistrationNotificationRecipient[]> {
  const { data, error } = await supabase.rpc(
    "list_registration_notification_recipients",
    { p_organization_id: organizationId },
  )

  if (error) throw error

  return ((data ?? []) as Record<string, unknown>[]).map(
    mapRecipient,
  )
}

export async function loadRegistrationNotificationRecipients(): Promise<
  RegistrationNotificationRecipient[]
> {
  const { organizationId, role } =
    await getCurrentOrganizationContext()

  if (role !== "owner" && role !== "admin") {
    throw new Error(
      "Only an owner or administrator can manage registration email notifications.",
    )
  }

  return listRecipients(organizationId)
}

export async function saveRegistrationNotificationRecipient(
  recipient: RegistrationNotificationRecipient,
): Promise<RegistrationNotificationRecipient[]> {
  const { organizationId, role } =
    await getCurrentOrganizationContext()

  if (role !== "owner" && role !== "admin") {
    throw new Error(
      "Only an owner or administrator can manage registration email notifications.",
    )
  }

  const { error } = await supabase.rpc(
    "set_registration_notification_recipient",
    {
      p_organization_id: organizationId,
      p_user_id: recipient.userId,
      p_notify_staff_requests: recipient.notifyStaffRequests,
      p_notify_participant_registrations:
        recipient.notifyParticipantRegistrations,
    },
  )

  if (error) throw error

  return listRecipients(organizationId)
}
