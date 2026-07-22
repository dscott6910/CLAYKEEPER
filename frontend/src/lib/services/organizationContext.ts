import { supabase } from "@/lib/supabase"

export type OrganizationContext = {
  userId: string
  organizationId: string
  role: string
}

export async function getCurrentOrganizationContext(): Promise<OrganizationContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error("No authenticated user was found. Please sign in again.")

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data?.organization_id) {
    throw new Error("Your account is not assigned to an active organization.")
  }

  return {
    userId: user.id,
    organizationId: data.organization_id as string,
    role: (data.role as string | null) ?? "member",
  }
}

export async function getCurrentOrganizationId(): Promise<string> {
  const context = await getCurrentOrganizationContext()
  return context.organizationId
}
