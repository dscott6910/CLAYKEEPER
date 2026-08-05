import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  deleteScorecardTemplate,
  loadScorecardTemplates,
  saveScorecardTemplate,
  type ScorecardTemplate,
  type ScorecardTemplatePayload,
} from "@/lib/services/scorecardTemplates"

const DISCIPLINES = [
  { value: "", label: "All disciplines" },
  { value: "american_trap", label: "American Trap" },
  { value: "skeet", label: "Skeet" },
  { value: "sporting_clays", label: "Sporting Clays" },
  { value: "bunker", label: "Bunker" },
]

const EMPTY_TEMPLATE: ScorecardTemplatePayload = {
  name: "CYSSA Standard Scorecard",
  description: "",
  discipline: null,
  orientation: "landscape",
  page_size: "letter_half",
  cards_per_page: 2,
  show_qr_code: true,
  show_event_name: true,
  show_event_date: true,
  show_location: true,
  show_host_sponsor: true,
  show_athlete_name: true,
  show_team_name: true,
  show_squad_number: true,
  show_post_number: true,
  show_cyssa_number: true,
  show_station_total: true,
  show_running_total: true,
  show_malfunctions: true,
  show_verification_fields: true,
  bubble_diameter: 0.19,
  grid_columns: 10,
  station_limit: 15,
  primary_color: "#111827",
  title_text: "CYSSA SCORECARD",
  footer_text: "",
  active: true,
}

export function ScorecardTemplateDesignerPage() {
  const [templates, setTemplates] = useState<ScorecardTemplate[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [form, setForm] = useState<ScorecardTemplatePayload>(EMPTY_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const rows = await loadScorecardTemplates()
      setTemplates(rows)
      setSelectedId((current) => {
        const next = rows.some((row) => row.id === current)
          ? current
          : rows[0]?.id ?? ""
        const chosen = rows.find((row) => row.id === next)
        if (chosen) setForm(templateToPayload(chosen))
        return next
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load templates.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => templates.find((row) => row.id === selectedId) ?? null,
    [selectedId, templates],
  )

  function update<K extends keyof ScorecardTemplatePayload>(
    key: K,
    value: ScorecardTemplatePayload[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function chooseTemplate(id: string) {
    setSelectedId(id)
    const row = templates.find((template) => template.id === id)
    if (row) setForm(templateToPayload(row))
    setSuccess("")
    setError("")
  }

  function createNew() {
    setSelectedId("")
    setForm(EMPTY_TEMPLATE)
    setSuccess("")
    setError("")
  }

  function duplicate() {
    setSelectedId("")
    setForm((current) => ({ ...current, name: `${current.name} Copy` }))
    setSuccess("")
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Template name is required.")
      return
    }

    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const id = await saveScorecardTemplate(selectedId || null, form)
      setSelectedId(id)
      setSuccess("Scorecard template saved.")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save template.")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!selected) return
    if (!window.confirm(`Delete "${selected.name}"?`)) return
    setSaving(true)
    try {
      await deleteScorecardTemplate(selected.id)
      setSelectedId("")
      setForm(EMPTY_TEMPLATE)
      setSuccess("Template deleted.")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete template.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading scorecard templates…
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                Scorecard Template Library
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                Scorecard Designer
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Create reusable layouts for CYSSA series, state events,
                US Open events, and custom club shoots.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" onClick={createNew}>
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-4">
              <h2 className="font-bold">Templates</h2>
            </div>
            <div className="space-y-2 p-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => chooseTemplate(template.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selectedId === template.id
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">{template.name}</p>
                  <p className="mt-1 text-xs opacity-75">
                    {template.cards_per_page} per page · {template.orientation}
                  </p>
                </button>
              ))}
              {templates.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
                  No templates yet.
                </div>
              ) : null}
            </div>
          </aside>

          <main className="space-y-5">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Template name">
                  <input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    className="min-h-11 w-full rounded-lg border px-3"
                  />
                </Field>
                <Field label="Discipline">
                  <select
                    value={form.discipline ?? ""}
                    onChange={(e) => update("discipline", e.target.value || null)}
                    className="min-h-11 w-full rounded-lg border bg-white px-3"
                  >
                    {DISCIPLINES.map((item) => (
                      <option key={item.value || "all"} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Title text">
                  <input
                    value={form.title_text}
                    onChange={(e) => update("title_text", e.target.value)}
                    className="min-h-11 w-full rounded-lg border px-3"
                  />
                </Field>
                <Field label="Primary color">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => update("primary_color", e.target.value)}
                    className="h-11 w-full rounded-lg border p-1"
                  />
                </Field>
                <Field label="Orientation">
                  <select
                    value={form.orientation}
                    onChange={(e) =>
                      update(
                        "orientation",
                        e.target.value as ScorecardTemplatePayload["orientation"],
                      )
                    }
                    className="min-h-11 w-full rounded-lg border bg-white px-3"
                  >
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </Field>
                <Field label="Cards per page">
                  <select
                    value={form.cards_per_page}
                    onChange={(e) => update("cards_per_page", Number(e.target.value))}
                    className="min-h-11 w-full rounded-lg border bg-white px-3"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </Field>
                <Field label="Station limit">
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={form.station_limit}
                    onChange={(e) => update("station_limit", Number(e.target.value))}
                    className="min-h-11 w-full rounded-lg border px-3"
                  />
                </Field>
                <Field label="Bird columns">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.grid_columns}
                    onChange={(e) => update("grid_columns", Number(e.target.value))}
                    className="min-h-11 w-full rounded-lg border px-3"
                  />
                </Field>
                <Field label="Bubble diameter (inches)">
                  <input
                    type="number"
                    min={0.1}
                    max={0.3}
                    step={0.01}
                    value={form.bubble_diameter}
                    onChange={(e) => update("bubble_diameter", Number(e.target.value))}
                    className="min-h-11 w-full rounded-lg border px-3"
                  />
                </Field>
                <Field label="Footer text">
                  <input
                    value={form.footer_text ?? ""}
                    onChange={(e) => update("footer_text", e.target.value)}
                    className="min-h-11 w-full rounded-lg border px-3"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Visible Fields</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {checkboxes.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(form[key])}
                      onChange={(e) =>
                        update(key, e.target.checked as never)
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Preview</h2>
              <div className="mt-4 rounded-xl border bg-slate-50 p-5">
                <div
                  className="mx-auto border bg-white p-4 shadow-sm"
                  style={{
                    width: form.orientation === "landscape" ? "520px" : "360px",
                    maxWidth: "100%",
                    borderColor: form.primary_color,
                  }}
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-black">{form.title_text}</h3>
                      {form.show_event_name ? <p className="text-xs">2026 Sporting Clays Series 3</p> : null}
                      {form.show_athlete_name ? <p className="mt-2 text-sm font-bold">Athlete: Sample Athlete</p> : null}
                      {form.show_team_name ? <p className="text-xs">Team: Sample Team</p> : null}
                    </div>
                    {form.show_qr_code ? (
                      <div className="flex h-16 w-16 items-center justify-center border text-[10px] font-bold">
                        QR
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-6 gap-1 text-center text-[9px]">
                    {Array.from({ length: 30 }, (_, index) => (
                      <div key={index} className="border p-1">
                        {index % 6 === 0 ? Math.floor(index / 6) + 1 : "○"}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              {selected ? (
                <>
                  <Button variant="outline" onClick={duplicate}>
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button variant="outline" onClick={() => void remove()}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : null}
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Template
              </Button>
            </div>
          </main>
        </section>
      </div>
    </PageContainer>
  )
}

const checkboxes: Array<
  [keyof ScorecardTemplatePayload, string]
> = [
  ["show_qr_code", "QR code"],
  ["show_event_name", "Event name"],
  ["show_event_date", "Event date"],
  ["show_location", "Location"],
  ["show_host_sponsor", "Host / sponsor"],
  ["show_athlete_name", "Athlete name"],
  ["show_team_name", "Team name"],
  ["show_squad_number", "Squad number"],
  ["show_post_number", "Post number"],
  ["show_cyssa_number", "CYSSA number"],
  ["show_station_total", "Station total"],
  ["show_running_total", "Running total"],
  ["show_malfunctions", "Malfunctions"],
  ["show_verification_fields", "Verification fields"],
]

function templateToPayload(
  template: ScorecardTemplate,
): ScorecardTemplatePayload {
  const {
    id: _id,
    organization_id: _organizationId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...payload
  } = template
  return payload
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-semibold">{props.label}</span>
      {props.children}
    </label>
  )
}