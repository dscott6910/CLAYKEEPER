import { defaultBrandSettings, type BrandSettings } from "@/lib/branding"
import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type OrganizationSettingsRecord = {
  organization_id: string
  display_name: string | null
  support_email: string | null
  report_subtitle: string
  report_footer: string
}

export async function loadOrganizationSettings(): Promise<BrandSettings> {
  const { organizationId } = await getCurrentOrganizationContext()

  const [organizationResult, settingsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single(),

    supabase
      .from("organization_settings")
      .select(
        "organization_id,display_name,support_email,report_subtitle,report_footer",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ])

  if (organizationResult.error) {
    throw organizationResult.error
  }

  if (settingsResult.error) {
    throw settingsResult.error
  }

  const settings =
    settingsResult.data as OrganizationSettingsRecord | null

  return {
    organizationName:
      settings?.display_name?.trim() ||
      String(organizationResult.data?.name || "").trim() ||
      defaultBrandSettings.organizationName,

    reportSubtitle:
      settings?.report_subtitle?.trim() ||
      defaultBrandSettings.reportSubtitle,

    reportFooter:
      settings?.report_footer?.trim() ||
      defaultBrandSettings.reportFooter,

    supportEmail:
      settings?.support_email?.trim() ||
      defaultBrandSettings.supportEmail,
  }
}

export async function saveOrganizationSettings(
  values: BrandSettings,
): Promise<BrandSettings> {
  const { organizationId, role } = await getCurrentOrganizationContext()

  if (role !== "owner" && role !== "admin") {
    throw new Error(
      `Your organization role is '${role}'. Only an owner or administrator can edit organization settings.`,
    )
  }

  const payload = {
    organization_id: organizationId,
    display_name: values.organizationName.trim() || null,
    support_email: values.supportEmail.trim() || null,
    report_subtitle:
      values.reportSubtitle.trim() ||
      defaultBrandSettings.reportSubtitle,
    report_footer:
      values.reportFooter.trim() ||
      defaultBrandSettings.reportFooter,
  }

  const { error } = await supabase
    .from("organization_settings")
    .upsert(payload, { onConflict: "organization_id" })

  if (error) throw error

  return loadOrganizationSettings()
}

export async function resetOrganizationSettings(): Promise<BrandSettings> {
  const { organizationId, role } = await getCurrentOrganizationContext()

  if (role !== "owner" && role !== "admin") {
    throw new Error(
      `Your organization role is '${role}'. Only an owner or administrator can edit organization settings.`,
    )
  }

  const { error } = await supabase
    .from("organization_settings")
    .delete()
    .eq("organization_id", organizationId)

  if (error) throw error

  return loadOrganizationSettings()
}
