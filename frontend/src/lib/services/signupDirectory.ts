import { supabase } from "@/lib/supabase"

export type SignupDirectoryOrganization = {
  organizationName: string
  organizationSlug: string
}

type SignupDirectoryRow = {
  organization_name: string | null
  organization_slug: string | null
}

export async function loadSignupDirectory():
  Promise<SignupDirectoryOrganization[]> {
  const { data, error } = await supabase.rpc(
    "list_participant_signup_organizations",
  )

  if (error) throw error

  return ((data ?? []) as SignupDirectoryRow[])
    .map((row: SignupDirectoryRow) => ({
      organizationName: String(
        row.organization_name || "",
      ),
      organizationSlug: String(
        row.organization_slug || "",
      ),
    }))
    .filter(
      (
        organization: SignupDirectoryOrganization,
      ) =>
        Boolean(
          organization.organizationName &&
            organization.organizationSlug,
        ),
    )
}
