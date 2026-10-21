import { useEffect, useState } from "react"
import {
  BellRing,
  CreditCard,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react"
import { Link } from "react-router-dom"

import { AppHeader } from "@/app/AppHeader"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  CLAYKEEPER_LOGO,
  defaultBrandSettings,
  saveBrandSettings,
} from "@/lib/branding"
import {
  loadOrganizationSettings,
  resetOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettings,
} from "@/lib/services/organizationSettings"
import {
  loadRegistrationNotificationRecipients,
  saveRegistrationNotificationRecipient,
  type RegistrationNotificationRecipient,
} from "@/lib/services/registrationNotifications"

export function SettingsPage() {
  const [form, setForm] = useState<OrganizationSettings>({
    ...defaultBrandSettings,
    stripePaymentsEnabled: false,
    seasonRegistrationFee: 35,
  })
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingRecipientId, setSavingRecipientId] = useState<
    string | null
  >(null)
  const [notificationRecipients, setNotificationRecipients] =
    useState<RegistrationNotificationRecipient[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")

      try {
        const [settings, recipients] = await Promise.all([
          loadOrganizationSettings(),
          loadRegistrationNotificationRecipients(),
        ])

        if (cancelled) return

        setForm(settings)
        setNotificationRecipients(recipients)
        saveBrandSettings(settings)
      } catch (caught) {
        if (cancelled) return

        setError(
          caught instanceof Error
            ? caught.message
            : "Organization settings could not be loaded.",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof OrganizationSettings>(key: K, value: OrganizationSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setMessage("")
  }

  async function save() {
    setSaving(true)
    setMessage("")
    setError("")

    try {
      const settings = await saveOrganizationSettings(form)
      setForm(settings)
      saveBrandSettings(settings)
      setMessage("Organization branding and report preferences were saved.")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Organization settings could not be saved.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    setSaving(true)
    setMessage("")
    setError("")

    try {
      const settings = await resetOrganizationSettings()
      setForm(settings)
      saveBrandSettings(settings)
      setMessage("Settings were restored to the organization defaults.")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Organization settings could not be reset.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function updateNotificationRecipient(
    recipient: RegistrationNotificationRecipient,
    changes: Partial<
      Pick<
        RegistrationNotificationRecipient,
        "notifyStaffRequests" | "notifyParticipantRegistrations"
      >
    >,
  ) {
    const updatedRecipient = { ...recipient, ...changes }

    setSavingRecipientId(recipient.userId)
    setMessage("")
    setError("")

    try {
      const recipients =
        await saveRegistrationNotificationRecipient(updatedRecipient)
      setNotificationRecipients(recipients)
      setMessage(
        `Registration email preferences for ${recipient.email || "this administrator"} were saved.`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Registration email preferences could not be saved.",
      )
    } finally {
      setSavingRecipientId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader title="Settings" description="Configure organization branding and report preferences" />

      <PageContainer>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Settings className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">Organization identity</h2>
                <p className="mt-1 text-sm text-slate-500">These values appear in the sidebar and official report headers.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field label="Organization name" value={form.organizationName} onChange={(value) => update("organizationName", value)} placeholder="Organization name" />
              <Field label="Support email" value={form.supportEmail} onChange={(value) => update("supportEmail", value)} placeholder="support@example.org" type="email" />
              <div className="md:col-span-2"><Field label="Report subtitle" value={form.reportSubtitle} onChange={(value) => update("reportSubtitle", value)} placeholder="Trap · Skeet · Sporting Clays" /></div>
              <div className="md:col-span-2"><Field label="Report footer" value={form.reportFooter} onChange={(value) => update("reportFooter", value)} placeholder="Official results generated by ClayKeeper" /></div>
            </div>

            <section className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">Online season-registration payments</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Enable this only after the Stripe checkout functions and secrets have been configured.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Season registration fee
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.seasonRegistrationFee}
                      onChange={(event) => update("seasonRegistrationFee", Number(event.target.value))}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-7 pr-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                </label>

                <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.stripePaymentsEnabled}
                    onChange={(event) => update("stripePaymentsEnabled", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Require Stripe payment
                </label>
              </div>
            </section>

            <section className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">
                    Registration email notifications
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose which owners and administrators receive new
                    participant notices and staff approval emails.
                  </p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {notificationRecipients.length === 0 && !loading ? (
                  <div className="px-4 py-5 text-sm text-slate-600">
                    No active owners or administrators are available.
                  </div>
                ) : (
                  notificationRecipients.map((recipient) => {
                    const savingThisRecipient =
                      savingRecipientId === recipient.userId

                    return (
                      <div
                        key={recipient.userId}
                        className="border-b border-slate-100 p-4 last:border-b-0"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {recipient.email || recipient.userId}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {recipient.role === "owner"
                                ? "Organization owner"
                                : "Administrator"}
                            </p>
                          </div>

                          {savingThisRecipient ? (
                            <span className="text-sm font-medium text-emerald-700">
                              Saving…
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              checked={
                                recipient.notifyParticipantRegistrations
                              }
                              onChange={(event) =>
                                void updateNotificationRecipient(
                                  recipient,
                                  {
                                    notifyParticipantRegistrations:
                                      event.target.checked,
                                  },
                                )
                              }
                              disabled={
                                loading || savingRecipientId !== null
                              }
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>
                              <span className="flex items-center gap-2 font-semibold text-slate-900">
                                <UserRoundCheck className="h-4 w-4 text-emerald-700" />
                                Participant registrations
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">
                                Sends a notice when a participant creates
                                a ClayKeeper account.
                              </span>
                            </span>
                          </label>

                          <label
                            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                              recipient.canReviewStaffRequests
                                ? "border-slate-200 text-slate-800"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={recipient.notifyStaffRequests}
                              onChange={(event) =>
                                void updateNotificationRecipient(
                                  recipient,
                                  {
                                    notifyStaffRequests:
                                      event.target.checked,
                                  },
                                )
                              }
                              disabled={
                                !recipient.canReviewStaffRequests ||
                                loading ||
                                savingRecipientId !== null
                              }
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>
                              <span className="flex items-center gap-2 font-semibold">
                                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                                Staff approval requests
                              </span>
                              <span className="mt-1 block text-xs leading-5">
                                Coach, admin, scorekeeper, and volunteer
                                requests, plus reminders while pending.
                              </span>
                              {!recipient.canReviewStaffRequests ? (
                                <span className="mt-1 block text-xs font-medium text-amber-700">
                                  This admin must first be selected as an
                                  approver on the Staff Access Requests
                                  page.
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Staff approval authority is managed separately on the{" "}
                <Link
                  to="/staff-requests"
                  className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Staff Access Requests
                </Link>{" "}
                page. Participant registrations are created immediately,
                so those emails are informational and do not require an
                approval.
              </p>
            </section>

            {loading ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading organization settings…
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {message}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => void save()}
                disabled={loading || saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save settings"}
              </Button>

              <Button
                variant="outline"
                onClick={() => void reset()}
                disabled={loading || saving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore defaults
              </Button>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Brand preview</p>
            <img src={CLAYKEEPER_LOGO} alt="ClayKeeper TMK" className="mx-auto mt-5 h-48 w-full object-contain" />
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold">{form.organizationName || "Organization"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{form.reportSubtitle || "Trap · Skeet · Sporting Clays"}</p>
              <p className="mt-4 text-xs text-slate-400">{form.reportFooter || "Official results generated by ClayKeeper"}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">The finalized ClayKeeper TMK logo is built into this release and is used on login, navigation, print reports, and browser icons.</p>
          </aside>
        </div>
      </PageContainer>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  )
}
