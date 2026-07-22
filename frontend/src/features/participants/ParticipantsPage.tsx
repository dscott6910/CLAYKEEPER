import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  ArchiveRestore,
  BadgeCheck,
  Edit3,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  createParticipant,
  getParticipantDirectory,
  setParticipantActive,
  updateParticipant,
  type ParticipantClass,
  type ParticipantPayload,
  type ParticipantRecord,
  type ParticipantTeam,
} from "@/lib/services/participants"

type ParticipantForm = {
  first_name: string
  last_name: string
  preferred_name: string
  class_id: string
  team_id: string
  birth_date: string
  gender: string
  graduation_year: string
  cyssa_number: string
  ata_number: string
  nssa_number: string
  email: string
  phone: string
  emergency_contact_name: string
  emergency_contact_phone: string
  notes: string
  active: boolean
}

const EMPTY_FORM: ParticipantForm = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  class_id: "",
  team_id: "",
  birth_date: "",
  gender: "",
  graduation_year: "",
  cyssa_number: "",
  ata_number: "",
  nssa_number: "",
  email: "",
  phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  notes: "",
  active: true,
}

function optional(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error && "message" in error) return String(error.message)
  return "An unexpected error occurred."
}

function displayName(participant: ParticipantRecord) {
  return `${participant.preferred_name?.trim() || participant.first_name} ${participant.last_name}`.trim()
}

export function ParticipantsPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<ParticipantRecord[]>([])
  const [classes, setClasses] = useState<ParticipantClass[]>([])
  const [teams, setTeams] = useState<ParticipantTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
  const [showInactive, setShowInactive] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ParticipantRecord | null>(null)
  const [form, setForm] = useState<ParticipantForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getParticipantDirectory()
      setOrganizationId(data.organizationId)
      setParticipants(data.participants)
      setClasses(data.classes)
      setTeams(data.teams)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const classMap = useMemo(() => Object.fromEntries(classes.map((item) => [item.id, item])), [classes])
  const teamMap = useMemo(() => Object.fromEntries(teams.map((item) => [item.id, item])), [teams])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return participants.filter((participant) => {
      if (!showInactive && !participant.active) return false
      if (classFilter !== "all" && participant.class_id !== classFilter) return false
      if (teamFilter !== "all" && participant.team_id !== teamFilter) return false
      if (!query) return true

      return [
        displayName(participant),
        participant.first_name,
        participant.last_name,
        participant.cyssa_number,
        participant.ata_number,
        participant.nssa_number,
        participant.email,
        participant.phone,
        classMap[participant.class_id ?? ""]?.code,
        classMap[participant.class_id ?? ""]?.display_name,
        teamMap[participant.team_id ?? ""]?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [participants, showInactive, classFilter, teamFilter, search, classMap, teamMap])

  const stats = useMemo(() => ({
    total: participants.filter((participant) => participant.active).length,
    teams: new Set(participants.filter((participant) => participant.active && participant.team_id).map((participant) => participant.team_id)).size,
    registered: participants.filter((participant) => participant.registration_count > 0).length,
    missingClass: participants.filter((participant) => participant.active && !participant.class_id).length,
  }), [participants])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
    setError(null)
  }

  function openEdit(participant: ParticipantRecord) {
    setEditing(participant)
    setForm({
      first_name: participant.first_name,
      last_name: participant.last_name,
      preferred_name: participant.preferred_name ?? "",
      class_id: participant.class_id ?? "",
      team_id: participant.team_id ?? "",
      birth_date: participant.birth_date ?? "",
      gender: participant.gender ?? "",
      graduation_year: participant.graduation_year ? String(participant.graduation_year) : "",
      cyssa_number: participant.cyssa_number ?? "",
      ata_number: participant.ata_number ?? "",
      nssa_number: participant.nssa_number ?? "",
      email: participant.email ?? "",
      phone: participant.phone ?? "",
      emergency_contact_name: participant.emergency_contact_name ?? "",
      emergency_contact_phone: participant.emergency_contact_phone ?? "",
      notes: participant.notes ?? "",
      active: participant.active,
    })
    setEditorOpen(true)
    setError(null)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!organizationId) return
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.")
      return
    }

    const graduationYear = form.graduation_year ? Number(form.graduation_year) : null
    const payload: ParticipantPayload = {
      organization_id: organizationId,
      class_id: form.class_id || null,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      preferred_name: optional(form.preferred_name),
      birth_date: form.birth_date || null,
      gender: optional(form.gender),
      graduation_year: graduationYear,
      cyssa_number: optional(form.cyssa_number),
      ata_number: optional(form.ata_number),
      nssa_number: optional(form.nssa_number),
      email: optional(form.email),
      phone: optional(form.phone),
      emergency_contact_name: optional(form.emergency_contact_name),
      emergency_contact_phone: optional(form.emergency_contact_phone),
      notes: optional(form.notes),
      active: form.active,
    }

    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await updateParticipant(editing.id, payload, editing.team_id, form.team_id || null)
      } else {
        await createParticipant(payload, form.team_id || null)
      }
      setEditorOpen(false)
      await load()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(participant: ParticipantRecord) {
    const action = participant.active ? "archive" : "restore"
    if (!confirm(`${action === "archive" ? "Archive" : "Restore"} ${displayName(participant)}?`)) return
    try {
      await setParticipantActive(participant.id, !participant.active)
      await load()
    } catch (toggleError) {
      setError(errorMessage(toggleError))
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="Participants" description="Manage the organization athlete directory" />
      <PageContainer>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Participant Directory</h1>
              <p className="mt-1 text-sm text-slate-500">Athlete profiles, classifications, team assignments, and registration history.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold hover:bg-slate-50"><RefreshCw size={16} />Refresh</button>
              <button onClick={openNew} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={16} />Add Participant</button>
            </div>
          </div>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Users} label="Active Participants" value={stats.total} />
            <Stat icon={GraduationCap} label="Teams Represented" value={stats.teams} />
            <Stat icon={BadgeCheck} label="Previously Registered" value={stats.registered} />
            <Stat icon={UserRound} label="Missing Class" value={stats.missingClass} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_220px_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, number, team, class, email…" className="min-h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm" />
              </label>
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="all">All classes</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.display_name}</option>)}
              </select>
              <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="all">All teams</option>
                {teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium">
                <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Show archived
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 className="font-bold text-slate-950">Participants</h2><p className="text-sm text-slate-500">Showing {filtered.length} of {participants.length}</p></div>
            </div>
            {loading ? (
              <div className="p-12 text-center text-sm text-slate-500">Loading participants…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center"><Users className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 font-bold">No participants found</h3><p className="mt-1 text-sm text-slate-500">Adjust the filters or add the first participant.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Participant</th><th className="px-4 py-3">CYSSA #</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((participant) => {
                      const participantClass = classMap[participant.class_id ?? ""]
                      const team = teamMap[participant.team_id ?? ""]
                      return <tr key={participant.id} className={!participant.active ? "bg-slate-50 opacity-70" : "hover:bg-slate-50/70"}>
                        <td className="px-5 py-4"><div className="font-semibold text-slate-950">{displayName(participant)}</div>{participant.preferred_name ? <div className="text-xs text-slate-500">Legal: {participant.first_name} {participant.last_name}</div> : null}{participant.graduation_year ? <div className="mt-1 text-xs text-slate-500">Class of {participant.graduation_year}</div> : null}</td>
                        <td className="px-4 py-4 font-medium text-slate-700">{participant.cyssa_number || "—"}</td>
                        <td className="px-4 py-4">{participantClass ? <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700" title={participantClass.display_name}>{participantClass.code}</span> : <span className="text-slate-400">Not set</span>}</td>
                        <td className="px-4 py-4 text-slate-700">{team?.name ?? "Not assigned"}</td>
                        <td className="px-4 py-4"><div className="space-y-1 text-xs text-slate-600">{participant.email ? <div className="flex items-center gap-1.5"><Mail size={13} />{participant.email}</div> : null}{participant.phone ? <div className="flex items-center gap-1.5"><Phone size={13} />{participant.phone}</div> : null}{!participant.email && !participant.phone ? "—" : null}</div></td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{participant.registration_count}</td>
                        <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${participant.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{participant.active ? "Active" : "Archived"}</span></td>
                        <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(participant)} title="Edit participant" className="rounded-lg border p-2 text-slate-600 hover:bg-white"><Edit3 size={16} /></button><button onClick={() => void toggleActive(participant)} title={participant.active ? "Archive participant" : "Restore participant"} className="rounded-lg border p-2 text-slate-600 hover:bg-white"><ArchiveRestore size={16} /></button></div></td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </PageContainer>

      {editorOpen ? <ParticipantEditor form={form} setForm={setForm} classes={classes} teams={teams} editing={Boolean(editing)} saving={saving} onClose={() => setEditorOpen(false)} onSave={save} /> : null}
    </div>
  )
}

function ParticipantEditor({ form, setForm, classes, teams, editing, saving, onClose, onSave }: { form: ParticipantForm; setForm: React.Dispatch<React.SetStateAction<ParticipantForm>>; classes: ParticipantClass[]; teams: ParticipantTeam[]; editing: boolean; saving: boolean; onClose: () => void; onSave: (event: FormEvent) => void }) {
  const set = (key: keyof ParticipantForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4"><form onSubmit={onSave} className="mx-auto my-4 w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
    <div className="flex items-start justify-between border-b p-5"><div><h2 className="text-xl font-bold">{editing ? "Edit Participant" : "Add Participant"}</h2><p className="mt-1 text-sm text-slate-500">Maintain the athlete profile, classification, and current team.</p></div><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-semibold">Close</button></div>
    <div className="space-y-6 p-5">
      <EditorSection title="Participant information"><div className="grid gap-4 md:grid-cols-3"><Input label="First name" value={form.first_name} onChange={(value) => set("first_name", value)} required /><Input label="Last name" value={form.last_name} onChange={(value) => set("last_name", value)} required /><Input label="Preferred name" value={form.preferred_name} onChange={(value) => set("preferred_name", value)} /><Input label="Birth date" type="date" value={form.birth_date} onChange={(value) => set("birth_date", value)} /><Input label="Gender" value={form.gender} onChange={(value) => set("gender", value)} /><Input label="Graduation year" type="number" value={form.graduation_year} onChange={(value) => set("graduation_year", value)} /></div></EditorSection>
      <EditorSection title="Competition details"><div className="grid gap-4 md:grid-cols-2"><Select label="Class" value={form.class_id} onChange={(value) => set("class_id", value)} options={[{ value: "", label: "Not assigned" }, ...classes.map((item) => ({ value: item.id, label: `${item.code} — ${item.display_name}` }))]} /><Select label="Primary team" value={form.team_id} onChange={(value) => set("team_id", value)} options={[{ value: "", label: "Not assigned" }, ...teams.map((item) => ({ value: item.id, label: item.name }))]} /><Input label="CYSSA number" value={form.cyssa_number} onChange={(value) => set("cyssa_number", value)} /><Input label="ATA number" value={form.ata_number} onChange={(value) => set("ata_number", value)} /><Input label="NSSA number" value={form.nssa_number} onChange={(value) => set("nssa_number", value)} /></div></EditorSection>
      <EditorSection title="Contact and emergency information"><div className="grid gap-4 md:grid-cols-2"><Input label="Email" type="email" value={form.email} onChange={(value) => set("email", value)} /><Input label="Phone" type="tel" value={form.phone} onChange={(value) => set("phone", value)} /><Input label="Emergency contact" value={form.emergency_contact_name} onChange={(value) => set("emergency_contact_name", value)} /><Input label="Emergency phone" type="tel" value={form.emergency_contact_phone} onChange={(value) => set("emergency_contact_phone", value)} /></div></EditorSection>
      <EditorSection title="Notes"><textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm" placeholder="Optional notes about this participant" /></EditorSection>
      <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} />Active participant</label>
    </div>
    <div className="flex justify-end gap-2 border-t p-5"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-5 text-sm font-semibold">Cancel</button><button disabled={saving} className="min-h-11 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : editing ? "Save Changes" : "Add Participant"}</button></div>
  </form></div>
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5"><Icon size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-950">{value}</p></div></div></div> }
function EditorSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>{children}</section> }
function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label><span className="text-sm font-semibold text-slate-700">{label}</span><input required={required} type={type} min={type === "number" ? 1900 : undefined} max={type === "number" ? 2200 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label> }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label><span className="text-sm font-semibold text-slate-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> }
