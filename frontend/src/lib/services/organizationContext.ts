import { supabase } from "@/lib/supabase"
import {
  normalizeOrganizationRole,
  type OrganizationRole,
} from "@/lib/permissions"

export type OrganizationContext = {
  userId: string
  organizationId: string
  role: OrganizationRole
}

export type OrganizationMembershipOption = {
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: OrganizationRole
}

const SELECTED_ORGANIZATION_KEY_PREFIX =
  "claykeeper:selected-organization:"

function selectedOrganizationKey(userId: string) {
  return `${SELECTED_ORGANIZATION_KEY_PREFIX}${userId}`
}

function readSelectedOrganizationId(userId: string): string | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(
      selectedOrganizationKey(userId),
    )
  } catch {
    return null
  }
}

function writeSelectedOrganizationId(
  userId: string,
  organizationId: string,
) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      selectedOrganizationKey(userId),
      organizationId,
    )
  } catch {
    // Browser storage is optional. The validated membership fallback
    // remains authoritative when storage is unavailable.
  }
}

export async function getOrganizationMembershipOptions(
  userId?: string,
): Promise<OrganizationMembershipOption[]> {
  let resolvedUserId = userId

  if (!resolvedUserId) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw userError
    if (!user) {
      throw new Error(
        "No authenticated user was found. Please sign in again.",
      )
    }

    resolvedUserId = user.id
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "organization_id,role,created_at,organizations!inner(id,name,slug,active)",
    )
    .eq("user_id", resolvedUserId)
    .eq("active", true)
    .eq("organizations.active", true)
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => {
    const organization = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations

    return {
      organizationId: row.organization_id as string,
      organizationName: String(
        organization?.name || "Organization",
      ),
      organizationSlug: String(organization?.slug || ""),
      role: normalizeOrganizationRole(
        row.role as string | null,
      ),
    }
  })
}

export async function getCurrentOrganizationContext(): Promise<OrganizationContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) {
    throw new Error(
      "No authenticated user was found. Please sign in again.",
    )
  }

  const memberships =
    await getOrganizationMembershipOptions(user.id)

  if (memberships.length === 0) {
    throw new Error(
      "Your account is not assigned to an active organization.",
    )
  }

  const storedOrganizationId =
    readSelectedOrganizationId(user.id)

  const selectedMembership =
    memberships.find(
      (membership) =>
        membership.organizationId === storedOrganizationId,
    ) ?? memberships[0]

  // Persist the validated selection. This also repairs stale selections
  // when a membership has been removed or deactivated.
  writeSelectedOrganizationId(
    user.id,
    selectedMembership.organizationId,
  )

  return {
    userId: user.id,
    organizationId: selectedMembership.organizationId,
    role: selectedMembership.role,
  }
}

export async function selectCurrentOrganization(
  organizationId: string,
): Promise<OrganizationContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) {
    throw new Error(
      "No authenticated user was found. Please sign in again.",
    )
  }

  const memberships =
    await getOrganizationMembershipOptions(user.id)

  const membership = memberships.find(
    (candidate) =>
      candidate.organizationId === organizationId,
  )

  if (!membership) {
    throw new Error(
      "You do not have active access to that organization.",
    )
  }

  writeSelectedOrganizationId(
    user.id,
    membership.organizationId,
  )

  return {
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  }
}

export async function getCurrentOrganizationId(): Promise<string> {
  const context = await getCurrentOrganizationContext()
  return context.organizationId
}

export type CreateOrganizationInput = {
  name: string
  email?: string
  phone?: string
  website?: string
  city?: string
  state?: string
  postalCode?: string
  timezone?: string
}

function createOrganizationSlug(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  return base || "organization"
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<OrganizationContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError

  if (!user) {
    throw new Error(
      "No authenticated user was found. Please sign in again.",
    )
  }

  const name = input.name.trim()

  if (!name) {
    throw new Error("Organization name is required.")
  }

  const baseSlug = createOrganizationSlug(name)

  // Add a short random suffix so two organizations with the same
  // display name can coexist without exposing slug management to users.
  const suffix = crypto.randomUUID().slice(0, 8)
  const slug = `${baseSlug}-${suffix}`

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name,
      slug,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      timezone:
        input.timezone?.trim() || "America/Los_Angeles",
      country_code: "US",
      created_by: user.id,
      active: true,
    })
    .select("id")
    .single()

  if (error) throw error

  if (!data?.id) {
    throw new Error(
      "The organization was created but could not be selected.",
    )
  }

  // The database trigger automatically creates the creator's
  // owner membership. Select it immediately for the current session.
  return selectCurrentOrganization(data.id as string)
}
