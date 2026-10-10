import { defaultBrandSettings, type BrandSettings } from "@/lib/branding"
import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type OrganizationSettingsRecord = {
  organization_id: string
  display_name: string | null
  support_email: string | null
  report_subtitle: string
  report_footer: string
  stripe_payments_enabled: boolean
  season_registration_fee: number
}

export type OrganizationSettings = BrandSettings & {
  stripePaymentsEnabled: boolean
  seasonRegistrationFee: number
}

export async function loadOrganizationSettings(): Promise<OrganizationSettings> {
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
        "organization_id,display_name,support_email,report_subtitle,report_footer,stripe_payments_enabled,season_registration_fee",
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

    stripePaymentsEnabled:
      Boolean(settings?.stripe_payments_enabled),

    seasonRegistrationFee:
      Number(settings?.season_registration_fee ?? 35),
  }
}

export async function saveOrganizationSettings(
  values: OrganizationSettings,
): Promise<OrganizationSettings> {
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
    stripe_payments_enabled: values.stripePaymentsEnabled,
    season_registration_fee: Math.max(
      0,
      Number(values.seasonRegistrationFee || 0),
    ),
  }

  const { error } = await supabase
    .from("organization_settings")
    .upsert(payload, { onConflict: "organization_id" })

  if (error) throw error

  return loadOrganizationSettings()
}

export async function resetOrganizationSettings(): Promise<OrganizationSettings> {
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
