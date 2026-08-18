import { useState, type FormEvent } from "react"
import { Building2, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { useOrganization } from "@/features/organization/OrganizationProvider"
import {
  createOrganization,
  type CreateOrganizationInput,
} from "@/lib/services/organizationContext"

const DEFAULT_FORM: CreateOrganizationInput = {
  name: "",
  email: "",
  phone: "",
  website: "",
  city: "",
  state: "",
  postalCode: "",
  timezone: "America/Los_Angeles",
}

export function CreateOrganizationPage() {
  const navigate = useNavigate()
  const { refresh } = useOrganization()

  const [form, setForm] =
    useState<CreateOrganizationInput>(DEFAULT_FORM)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function update<K extends keyof CreateOrganizationInput>(
    key: K,
    value: CreateOrganizationInput[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))

    setError("")
  }

  async function submit(event: FormEvent) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError("Organization name is required.")
      return
    }

    setSaving(true)
    setError("")

    try {
      await createOrganization(form)

      // Reload the provider so memberships, role, and branding
      // all reflect the newly selected organization.
      await refresh()

      // A full reload ensures feature pages that resolve their own
      // organization context restart against the new club.
      window.location.assign("/")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Organization could not be created.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <AppHeader
        title="Create Organization"
        description="Add a club, association, or other organization that uses ClayKeeper"
      />

      <PageContainer>
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={submit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Organization details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  You will automatically become the owner of the new organization.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field
                label="Organization name"
                value={form.name}
                onChange={(value) => update("name", value)}
                placeholder="Example Shooting Club"
                required
              />

              <Field
                label="Email"
                value={form.email || ""}
                onChange={(value) => update("email", value)}
                placeholder="contact@example.org"
                type="email"
              />

              <Field
                label="Phone"
                value={form.phone || ""}
                onChange={(value) => update("phone", value)}
                placeholder="(555) 555-5555"
              />

              <Field
                label="Website"
                value={form.website || ""}
                onChange={(value) => update("website", value)}
                placeholder="https://example.org"
              />

              <Field
                label="City"
                value={form.city || ""}
                onChange={(value) => update("city", value)}
                placeholder="City"
              />

              <Field
                label="State"
                value={form.state || ""}
                onChange={(value) => update("state", value)}
                placeholder="CA"
              />

              <Field
                label="ZIP / Postal code"
                value={form.postalCode || ""}
                onChange={(value) => update("postalCode", value)}
                placeholder="00000"
              />

              <label className="block text-sm font-medium text-slate-700">
                Time zone

                <select
                  value={form.timezone || "America/Los_Angeles"}
                  onChange={(event) =>
                    update("timezone", event.target.value)
                  }
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="America/Los_Angeles">
                    Pacific Time
                  </option>
                  <option value="America/Denver">
                    Mountain Time
                  </option>
                  <option value="America/Chicago">
                    Central Time
                  </option>
                  <option value="America/New_York">
                    Eastern Time
                  </option>
                  <option value="America/Phoenix">
                    Arizona
                  </option>
                  <option value="America/Anchorage">
                    Alaska
                  </option>
                  <option value="Pacific/Honolulu">
                    Hawaii
                  </option>
                </select>
              </label>
            </div>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                {saving ? "Creating…" : "Create organization"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => navigate("/settings")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </PageContainer>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}

      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  )
}
