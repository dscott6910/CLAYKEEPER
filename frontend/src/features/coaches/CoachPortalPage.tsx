import { useEffect, useMemo, useState } from "react"
import { Bell, CheckCircle2, ClipboardList, Printer, RefreshCw, Target, Trophy, Users } from "lucide-react"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { loadCoachPortalData } from "@/lib/services/coachPortal"

type PortalData = Awaited<ReturnType<typeof loadCoachPortalData>>
type Tab = "overview" | "roster" | "events" | "scores" | "history"

function athleteName(athlete: PortalData["athletes"][number]) {
  return `${athlete.preferred_name?.trim() || athlete.first_name} ${athlete.last_name}`.trim()
}

function formatDate(value: string | null) {
  if (!value) return "Date TBD"
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

export function CoachPortalPage() {
  const [data, setData] = useState<PortalData | null>(null)
  const [teamId, setTeamId] = useState("")
  const [eventId, setEventId] = useState("")
  const [tab, setTab] = useState<Tab>("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      const next = await loadCoachPortalData()
      setData(next)
      setTeamId((current) => current && next.teams.some((team) => team.id === current) ? current : next.teams[0]?.id || "")
      setEventId((current) => current && next.events.some((event) => event.id === current) ? current : next.events[0]?.id || "")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load the coach portal.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const teamAthleteIds = useMemo(() => new Set((data?.athleteTeams ?? []).filter((row) => row.team_id === teamId && (!row.end_date || row.end_date >= new Date().toISOString().slice(0, 10))).map((row) => row.athlete_id)), [data, teamId])
  const roster = useMemo(() => (data?.athletes ?? []).filter((athlete) => teamAthleteIds.has(athlete.id)), [data, teamAthleteIds])
  const selectedEvent = data?.events.find((event) => event.id === eventId)
  const registrations = useMemo(() => (data?.registrations ?? []).filter((row) => row.event_id === eventId && row.team_id === teamId), [data, eventId, teamId])
  const registrationIds = useMemo(() => new Set(registrations.map((row) => row.id)), [registrations])
  const eventShoots = useMemo(() => (data?.shoots ?? []).filter((shoot) => shoot.event_id === eventId), [data, eventId])
  const shootIds = useMemo(() => new Set(eventShoots.map((shoot) => shoot.id)), [eventShoots])
  const enrollments = useMemo(() => (data?.enrollments ?? []).filter((row) => registrationIds.has(row.registration_id) && shootIds.has(row.shoot_id)), [data, registrationIds, shootIds])
  const enrollmentIds = useMemo(() => new Set(enrollments.map((row) => row.id)), [enrollments])
  const members = useMemo(() => (data?.members ?? []).filter((row) => enrollmentIds.has(row.registration_shoot_id)), [data, enrollmentIds])
  const memberIds = useMemo(() => new Set(members.map((row) => row.id)), [members])
  const scores = useMemo(() => (data?.scores ?? []).filter((row) => memberIds.has(row.squad_member_id)), [data, memberIds])

  const rows = useMemo(() => registrations.map((registration) => {
    const athlete = data?.athletes.find((item) => item.id === registration.athlete_id)
    const athleteEnrollments = enrollments.filter((item) => item.registration_id === registration.id)
    const athleteMembers = members.filter((member) => athleteEnrollments.some((entry) => entry.id === member.registration_shoot_id))
    const athleteScores = scores.filter((score) => athleteMembers.some((member) => member.id === score.squad_member_id))
    const total = athleteScores.reduce((sum, score) => sum + (score.score ?? 0), 0) + athleteEnrollments.reduce((sum, entry) => sum + (entry.historical_total_score ?? 0), 0)
    const squadMember = athleteMembers[0]
    const squad = data?.squads.find((item) => item.id === squadMember?.squad_id)
    const classRecord = data?.classes.find((item) => item.id === registration.class_id)
    return { registration, athlete, athleteEnrollments, athleteScores, total, squadMember, squad, classRecord }
  }), [registrations, data, enrollments, members, scores])

  const checkedIn = registrations.filter((row) => row.checked_in).length
  const assigned = enrollments.filter((row) => row.squad_assignment_status === "assigned").length
  const complete = rows.filter((row) => row.athleteEnrollments.length > 0 && row.athleteEnrollments.every((entry) => {
    if (entry.historical_total_score !== null) return true
    const shoot = data?.shoots.find((item) => item.id === entry.shoot_id)
    const member = members.find((item) => item.registration_shoot_id === entry.id)
    return !!shoot && !!member && scores.filter((score) => score.squad_member_id === member.id && score.score !== null).length >= shoot.number_of_rounds
  })).length

  return (
    <div className="min-h-screen">
      <AppHeader title="Coach Portal" description="Team roster, event readiness, squadding, scores, and athlete history in one workspace." />
      <PageContainer>
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm font-medium">Team<select className="mt-1 w-full rounded-lg border px-3 py-2" value={teamId} onChange={(event) => setTeamId(event.target.value)}>{data?.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
              <label className="text-sm font-medium">Event<select className="mt-1 w-full rounded-lg border px-3 py-2" value={eventId} onChange={(event) => setEventId(event.target.value)}>{data?.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
              <div className="flex items-end gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button></div>
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
          {!loading && data && data.teams.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">No team is assigned to this coach account. An owner or administrator can link the coach to a team in the database.</div>}

          <div className="flex flex-wrap gap-2 print:hidden">{([['overview','Overview'],['roster','Roster'],['events','Event Readiness'],['scores','Scores'],['history','Athlete History']] as const).map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{label}</Button>)}</div>

          {loading ? <div className="py-20 text-center text-slate-500">Loading coach workspace…</div> : data && <>
            {tab === "overview" && <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric icon={Users} label="Team roster" value={roster.length} />
                <Metric icon={ClipboardList} label="Registered" value={registrations.length} />
                <Metric icon={CheckCircle2} label="Checked in" value={checkedIn} />
                <Metric icon={Target} label="Squad assigned" value={assigned} />
                <Metric icon={Trophy} label="Scores complete" value={complete} />
              </div>
              <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Team status for {selectedEvent?.name || "selected event"}</h2><p className="text-sm text-slate-500">{formatDate(selectedEvent?.start_date ?? null)}</p></div><TeamTable rows={rows} /></section>
              <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Bell className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-bold">Coach notifications</h2></div>{data.announcements.length === 0 ? <p className="text-sm text-slate-500">No current announcements.</p> : <div className="space-y-3">{data.announcements.filter((item) => !item.event_id || item.event_id === eventId).map((item) => <div key={item.id} className="rounded-xl border bg-slate-50 p-4"><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.message}</p></div>)}</div>}</section>
            </div>}

            {tab === "roster" && <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Current team roster</h2><p className="text-sm text-slate-500">Contact details and participant classifications.</p></div><div className="divide-y">{roster.map((athlete) => { const classRecord = data.classes.find((item) => item.id === athlete.class_id); return <div key={athlete.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_auto_auto]"><div><p className="font-semibold">{athleteName(athlete)}</p><p className="text-xs text-slate-500">CYSSA #{athlete.cyssa_number || "—"}</p></div><p className="text-sm">{classRecord?.code || "No class"}</p><p className="text-sm text-slate-500">{athlete.email || athlete.phone || "No contact on file"}</p></div>})}</div></section>}

            {tab === "events" && <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Event readiness</h2></div><TeamTable rows={rows} /></section>}

            {tab === "scores" && <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Live team scores</h2><p className="text-sm text-slate-500">Round totals update from Live Scoring.</p></div><TeamTable rows={[...rows].sort((a,b) => b.total-a.total)} showScore /></section>}

            {tab === "history" && <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Athlete season history</h2><p className="text-sm text-slate-500">Completed and historical totals across available events.</p></div><div className="divide-y">{roster.map((athlete) => { const athleteRegs = data.registrations.filter((item) => item.athlete_id === athlete.id); const regIds = new Set(athleteRegs.map((item) => item.id)); const athleteEntries = data.enrollments.filter((item) => regIds.has(item.registration_id)); const historical = athleteEntries.reduce((sum, item) => sum + (item.historical_total_score ?? 0), 0); return <div key={athlete.id} className="grid grid-cols-[1fr_auto_auto] gap-4 p-5"><p className="font-semibold">{athleteName(athlete)}</p><p className="text-sm text-slate-500">{athleteRegs.length} events</p><p className="font-bold">{historical || "—"}</p></div>})}</div></section>}
          </>}
        </div>
      </PageContainer>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-3xl font-black">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
}

function TeamTable({ rows, showScore = false }: { rows: Array<any>; showScore?: boolean }) {
  if (rows.length === 0) return <div className="p-10 text-center text-slate-500">No team participants are registered for this event.</div>
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Participant</th><th className="px-5 py-3">Class</th><th className="px-5 py-3">Check-in</th><th className="px-5 py-3">Squad / Post</th><th className="px-5 py-3">Payment</th>{showScore && <th className="px-5 py-3 text-right">Score</th>}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.registration.id}><td className="px-5 py-4 font-semibold">{row.athlete ? athleteName(row.athlete) : "Unknown participant"}</td><td className="px-5 py-4">{row.classRecord?.code || "—"}</td><td className="px-5 py-4">{row.registration.checked_in ? "Checked in" : "Pending"}</td><td className="px-5 py-4">{row.squad ? `Squad ${row.squad.squad_number}${row.squadMember ? ` · ${row.squadMember.position_label || `Post ${row.squadMember.position}`}` : ""}` : "Unassigned"}</td><td className="px-5 py-4 capitalize">{row.registration.payment_status.replaceAll("_", " ")}</td>{showScore && <td className="px-5 py-4 text-right text-lg font-bold">{row.total}</td>}</tr>)}</tbody></table></div>
}
