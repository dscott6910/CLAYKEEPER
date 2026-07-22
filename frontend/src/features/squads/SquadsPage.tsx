import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Lock,
  LockOpen,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import {
  assignEnrollment,
  createSquad,
  deleteSquad,
  loadShootSquaddingData,
  loadSquaddingBaseData,
  moveMember,
  removeMember,
  updateSquad,
  type AthleteSnapshot,
  type ClassSnapshot,
  type EnrollmentRecord,
  type NamedRecord,
  type RegistrationSnapshot,
  type SquadEvent,
  type SquadMemberRecord,
  type SquadRecord,
  type SquadShoot,
} from "@/lib/services/squads"

type FormState = {
  squadNumber: string
  name: string
  assignment: string
  startTime: string
  capacity: string
}

const emptyForm: FormState = { squadNumber: "", name: "", assignment: "", startTime: "", capacity: "5" }

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not set"
}

function athleteName(athlete?: AthleteSnapshot) {
  if (!athlete) return "Unknown participant"
  const first = athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim() || "Unnamed participant"
}

function positionLabel(discipline: string, position: number) {
  if (discipline === "american_trap" || discipline === "bunker") return `Post ${position}`
  return `Position ${position}`
}

export function SquadsPage() {
  const [organizationId, setOrganizationId] = useState("")
  const [events, setEvents] = useState<SquadEvent[]>([])
  const [shoots, setShoots] = useState<SquadShoot[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [selectedShootId, setSelectedShootId] = useState("")
  const [squads, setSquads] = useState<SquadRecord[]>([])
  const [members, setMembers] = useState<SquadMemberRecord[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [registrations, setRegistrations] = useState<RegistrationSnapshot[]>([])
  const [athletes, setAthletes] = useState<AthleteSnapshot[]>([])
  const [teams, setTeams] = useState<NamedRecord[]>([])
  const [classes, setClasses] = useState<ClassSnapshot[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingShoot, setLoadingShoot] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const selectedShoot = useMemo(() => shoots.find((shoot) => shoot.id === selectedShootId) ?? null, [shoots, selectedShootId])
  const eventShoots = useMemo(() => shoots.filter((shoot) => shoot.event_id === selectedEventId), [shoots, selectedEventId])
  const registrationById = useMemo(() => new Map(registrations.map((row) => [row.id, row])), [registrations])
  const athleteById = useMemo(() => new Map(athletes.map((row) => [row.id, row])), [athletes])
  const teamById = useMemo(() => new Map(teams.map((row) => [row.id, row])), [teams])
  const classById = useMemo(() => new Map(classes.map((row) => [row.id, row])), [classes])
  const enrollmentById = useMemo(() => new Map(enrollments.map((row) => [row.id, row])), [enrollments])
  const memberByEnrollmentId = useMemo(() => new Map(members.map((row) => [row.registration_shoot_id, row])), [members])

  const participantForEnrollment = useCallback((enrollment: EnrollmentRecord) => {
    const registration = registrationById.get(enrollment.registration_id)
    const athlete = registration ? athleteById.get(registration.athlete_id) : undefined
    return {
      registration,
      athlete,
      name: athleteName(athlete),
      team: registration?.team_id ? teamById.get(registration.team_id)?.name ?? "No team" : "No team",
      competitionClass: registration?.class_id ? classById.get(registration.class_id)?.display_name ?? "No class" : "No class",
    }
  }, [athleteById, classById, registrationById, teamById])

  const unassigned = useMemo(() => {
    const query = search.trim().toLowerCase()
    return enrollments.filter((row) => !memberByEnrollmentId.has(row.id)).filter((row) => {
      if (!query) return true
      const participant = participantForEnrollment(row)
      return [participant.name, participant.team, participant.competitionClass, participant.athlete?.cyssa_number, participant.registration?.registration_number]
        .filter(Boolean).join(" ").toLowerCase().includes(query)
    })
  }, [enrollments, memberByEnrollmentId, participantForEnrollment, search])

  const membersBySquad = useMemo(() => {
    const map = new Map<string, SquadMemberRecord[]>()
    for (const member of members) {
      const rows = map.get(member.squad_id) ?? []
      rows.push(member)
      map.set(member.squad_id, rows)
    }
    for (const rows of map.values()) rows.sort((a, b) => a.position - b.position)
    return map
  }, [members])

  const loadBase = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await loadSquaddingBaseData()
      setOrganizationId(data.organizationId); setEvents(data.events); setShoots(data.shoots)
      const firstEvent = data.events[0]?.id ?? ""
      setSelectedEventId((current) => current || firstEvent)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load squadding.") }
    finally { setLoading(false) }
  }, [])

  const loadShoot = useCallback(async () => {
    if (!organizationId || !selectedEventId || !selectedShootId) {
      setSquads([]); setMembers([]); setEnrollments([]); return
    }
    setLoadingShoot(true); setError("")
    try {
      const data = await loadShootSquaddingData(organizationId, selectedEventId, selectedShootId)
      setSquads(data.squads); setMembers(data.members); setEnrollments(data.enrollments)
      setRegistrations(data.registrations); setAthletes(data.athletes); setTeams(data.teams); setClasses(data.classes)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load this shoot.") }
    finally { setLoadingShoot(false) }
  }, [organizationId, selectedEventId, selectedShootId])

  useEffect(() => { void loadBase() }, [loadBase])
  useEffect(() => {
    const first = eventShoots[0]?.id ?? ""
    if (!eventShoots.some((shoot) => shoot.id === selectedShootId)) setSelectedShootId(first)
  }, [eventShoots, selectedShootId])
  useEffect(() => { void loadShoot() }, [loadShoot])

  async function runAction(action: () => Promise<void>, message: string) {
    setBusy(true); setError(""); setSuccess("")
    try { await action(); await loadShoot(); setSuccess(message) }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The action could not be completed.") }
    finally { setBusy(false) }
  }

  async function handleCreateSquad() {
    if (!selectedShoot || !form.squadNumber.trim()) { setError("Enter a squad number."); return }
    await runAction(async () => {
      await createSquad({
        organization_id: organizationId,
        shoot_id: selectedShoot.id,
        squad_number: form.squadNumber.trim(),
        name: form.name.trim() || null,
        house_number: selectedShoot.discipline === "american_trap" || selectedShoot.discipline === "skeet" || selectedShoot.discipline === "bunker" ? form.assignment.trim() || null : null,
        course_name: selectedShoot.discipline === "sporting_clays" ? form.assignment.trim() || null : null,
        station_name: null,
        flight_name: null,
        start_time: form.startTime || null,
        capacity: Math.max(1, Number(form.capacity) || selectedShoot.squad_size || 5),
        sort_order: squads.length,
        assignment_method: "manual",
        notes: null,
      })
      setForm({ ...emptyForm, capacity: String(selectedShoot.squad_size || 5) }); setShowForm(false)
    }, "Squad created.")
  }

  async function assignToSquad(enrollment: EnrollmentRecord, squad: SquadRecord) {
    const occupied = new Set((membersBySquad.get(squad.id) ?? []).map((member) => member.position))
    const position = Array.from({ length: squad.capacity }, (_, index) => index + 1).find((value) => !occupied.has(value))
    if (!position) { setError(`${squad.name || `Squad ${squad.squad_number}`} is full.`); return }
    await runAction(() => assignEnrollment({ organizationId, shootId: squad.shoot_id, squadId: squad.id, registrationShootId: enrollment.id, position, label: positionLabel(selectedShoot?.discipline ?? "", position) }), "Participant assigned.")
  }

  async function autoGenerate() {
    if (!selectedShoot || unassigned.length === 0) return
    await runAction(async () => {
      const capacity = selectedShoot.squad_size || 5
      const currentSquads = [...squads].filter((squad) => !squad.is_locked)
      const occupiedBySquad = new Map<string, Set<number>>()
      for (const squad of currentSquads) {
        occupiedBySquad.set(
          squad.id,
          new Set((membersBySquad.get(squad.id) ?? []).map((member) => member.position)),
        )
      }

      let nextNumber = squads.length + 1
      for (const enrollment of unassigned) {
        let target = currentSquads.find((squad) => (occupiedBySquad.get(squad.id)?.size ?? 0) < squad.capacity)
        if (!target) {
          const squadNumber = String(nextNumber++)
          const { data, error: insertError } = await supabase
            .from("squads")
            .insert({
              organization_id: organizationId,
              shoot_id: selectedShoot.id,
              squad_number: squadNumber,
              name: `Squad ${squadNumber}`,
              capacity,
              sort_order: nextNumber - 2,
              assignment_method: "automatic",
              status: "open",
              is_locked: false,
            })
            .select("*")
            .single()
          if (insertError) throw new Error(insertError.message)
          target = data as SquadRecord
          currentSquads.push(target)
          occupiedBySquad.set(target.id, new Set())
        }

        const occupied = occupiedBySquad.get(target.id) ?? new Set<number>()
        const position = Array.from({ length: target.capacity }, (_, index) => index + 1)
          .find((value) => !occupied.has(value))
        if (!position) continue

        await assignEnrollment({
          organizationId,
          shootId: selectedShoot.id,
          squadId: target.id,
          registrationShootId: enrollment.id,
          position,
          label: positionLabel(selectedShoot.discipline, position),
          method: "automatic",
        })
        occupied.add(position)
        occupiedBySquad.set(target.id, occupied)
      }
    }, "Unassigned participants were placed into squads.")
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title="Squadding" description="Build squads and assign participants to houses, courses, and posts" />
      <PageContainer className="space-y-6">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1 text-sm font-medium text-slate-700">Event
              <select className="mt-1 w-full rounded-lg border px-3 py-2.5" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">Shoot
              <select className="mt-1 w-full rounded-lg border px-3 py-2.5" value={selectedShootId} onChange={(event) => setSelectedShootId(event.target.value)}>
                {eventShoots.map((shoot) => <option key={shoot.id} value={shoot.id}>{shoot.name} — {label(shoot.discipline)}</option>)}
              </select>
            </label>
            <Button className="self-end" variant="outline" onClick={() => void loadShoot()} disabled={loadingShoot}><RefreshCw className={`h-4 w-4 ${loadingShoot ? "animate-spin" : ""}`} />Refresh</Button>
          </div>
        </section>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{success}</div> : null}

        {!selectedShoot ? <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-slate-500">Create or select a shoot before building squads.</div> : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[{ icon: Users, title: "Registered", value: enrollments.length }, { icon: Target, title: "Squads", value: squads.length }, { icon: UserPlus, title: "Assigned", value: members.length }, { icon: Sparkles, title: "Unassigned", value: enrollments.length - members.length }].map((item) => <div key={item.title} className="rounded-2xl border bg-white p-5 shadow-sm"><item.icon className="mb-3 h-5 w-5 text-emerald-600" /><p className="text-sm text-slate-500">{item.title}</p><p className="text-3xl font-semibold text-slate-950">{item.value}</p></div>)}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-xl font-semibold">{selectedShoot.name}</h3><p className="text-sm text-slate-500">{label(selectedShoot.discipline)} · Standard squad size {selectedShoot.squad_size || 5}</p></div>
              <div className="flex gap-2"><Button variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" />New Squad</Button><Button onClick={() => void autoGenerate()} disabled={busy || unassigned.length === 0}><Sparkles className="h-4 w-4" />Auto Squad {unassigned.length}</Button></div>
            </div>

            {showForm ? <section className="rounded-2xl border bg-white p-5 shadow-sm"><h4 className="mb-4 font-semibold">Create squad</h4><div className="grid gap-4 md:grid-cols-5">
              <input className="rounded-lg border px-3 py-2" placeholder="Squad number *" value={form.squadNumber} onChange={(e) => setForm({ ...form, squadNumber: e.target.value })} />
              <input className="rounded-lg border px-3 py-2" placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="rounded-lg border px-3 py-2" placeholder={selectedShoot.discipline === "sporting_clays" ? "Course (East/West)" : "House number"} value={form.assignment} onChange={(e) => setForm({ ...form, assignment: e.target.value })} />
              <input className="rounded-lg border px-3 py-2" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              <input className="rounded-lg border px-3 py-2" type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void handleCreateSquad()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create Squad</Button></div></section> : null}

            <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="rounded-2xl border bg-white shadow-sm">
                <div className="border-b p-4"><h4 className="font-semibold">Unassigned participants</h4><div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" placeholder="Search name, team, class..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
                <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">{unassigned.map((enrollment) => { const participant = participantForEnrollment(enrollment); return <div key={enrollment.id} className="rounded-xl border p-3"><p className="font-medium">{participant.name}</p><p className="text-xs text-slate-500">{participant.team} · {participant.competitionClass}</p><select className="mt-3 w-full rounded-lg border px-2 py-1.5 text-sm" defaultValue="" onChange={(e) => { const squad = squads.find((row) => row.id === e.target.value); if (squad) void assignToSquad(enrollment, squad); e.currentTarget.value = "" }} disabled={busy || squads.length === 0}><option value="">Assign to squad...</option>{squads.filter((squad) => !squad.is_locked && (membersBySquad.get(squad.id)?.length ?? 0) < squad.capacity).map((squad) => <option key={squad.id} value={squad.id}>{squad.name || `Squad ${squad.squad_number}`}</option>)}</select></div> })}{unassigned.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Everyone is assigned.</p> : null}</div>
              </aside>

              <main className="grid content-start gap-4 md:grid-cols-2 2xl:grid-cols-3">{squads.map((squad) => { const squadMembers = membersBySquad.get(squad.id) ?? []; const full = squadMembers.length >= squad.capacity; return <article key={squad.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><header className="flex items-start justify-between border-b p-4"><div><div className="flex items-center gap-2"><h4 className="font-semibold">{squad.name || `Squad ${squad.squad_number}`}</h4>{squad.is_locked ? <Lock className="h-4 w-4 text-amber-600" /> : null}</div><p className="text-xs text-slate-500">{squad.course_name ? `Course ${squad.course_name}` : squad.house_number ? `House ${squad.house_number}` : "Assignment not set"}{squad.start_time ? ` · ${squad.start_time.slice(0, 5)}` : ""}</p></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${full ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{squadMembers.length}/{squad.capacity}</span></header>
                <div className="space-y-2 p-3">{Array.from({ length: squad.capacity }, (_, index) => index + 1).map((position) => { const member = squadMembers.find((row) => row.position === position); const enrollment = member ? enrollmentById.get(member.registration_shoot_id) : undefined; const participant = enrollment ? participantForEnrollment(enrollment) : null; return <div key={position} className="flex min-h-16 items-center gap-3 rounded-xl border bg-slate-50 p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold shadow-sm">{position}</div>{member && participant ? <><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{participant.name}</p><p className="truncate text-xs text-slate-500">{participant.team} · {participant.competitionClass}</p></div><select className="w-9 rounded border bg-white py-1 text-xs" value={member.squad_id} title="Move participant" disabled={busy || squad.is_locked} onChange={(e) => { const destination = squads.find((row) => row.id === e.target.value); if (!destination) return; const taken = new Set((membersBySquad.get(destination.id) ?? []).map((row) => row.position)); const next = Array.from({ length: destination.capacity }, (_, i) => i + 1).find((value) => !taken.has(value)); if (next) void runAction(() => moveMember(member.id, destination.id, next, positionLabel(selectedShoot.discipline, next)), "Participant moved.") }}><option value={squad.id}>↔</option>{squads.filter((row) => row.id !== squad.id && !row.is_locked && (membersBySquad.get(row.id)?.length ?? 0) < row.capacity).map((row) => <option key={row.id} value={row.id}>{row.squad_number}</option>)}</select><button className="text-slate-400 hover:text-red-600 disabled:opacity-40" disabled={busy || squad.is_locked} onClick={() => void runAction(() => removeMember(member.id), "Participant returned to unassigned.")}><Trash2 className="h-4 w-4" /></button></> : <p className="text-sm text-slate-400">Open {positionLabel(selectedShoot.discipline, position).toLowerCase()}</p>}</div> })}</div>
                <footer className="flex items-center justify-between border-t bg-slate-50 px-3 py-2"><Button size="sm" variant="ghost" onClick={() => void runAction(() => updateSquad(squad.id, { is_locked: !squad.is_locked }), squad.is_locked ? "Squad unlocked." : "Squad locked.")} disabled={busy}>{squad.is_locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{squad.is_locked ? "Unlock" : "Lock"}</Button><Button size="sm" variant="ghost" className="text-red-600" disabled={busy || squad.is_locked || squadMembers.length > 0} onClick={() => void runAction(() => deleteSquad(squad.id), "Empty squad deleted.")}><Trash2 className="h-4 w-4" />Delete</Button></footer></article> })}{squads.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed bg-white p-12 text-center"><Target className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h4 className="font-semibold">No squads yet</h4><p className="mt-1 text-sm text-slate-500">Create one manually or automatically place all registered participants.</p></div> : null}</main>
            </div>
          </>
        )}
      </PageContainer>
    </div>
  )
}
