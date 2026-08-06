import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, CircleAlert, Loader2, Lock, RefreshCw, Save } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  loadDigitalScoring,
  saveDigitalScorecard,
  type DigitalScoringData,
} from "@/lib/services/digitalScoring"

function nameOf(athlete: DigitalScoringData["athletes"][number] | undefined) {
  if (!athlete) return "Unknown Athlete"
  const first = athlete.preferred_name?.trim() || athlete.first_name?.trim() || ""
  return `${first} ${athlete.last_name?.trim() || ""}`.trim()
}

export function LiveScoringPage() {
  const { eventId } = useParams()
  const [data, setData] = useState<DigitalScoringData | null>(null)
  const [shootId, setShootId] = useState("")
  const [squadId, setSquadId] = useState("")
  const [memberId, setMemberId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [scores, setScores] = useState<Record<string, string>>({})
  const [malfunctions, setMalfunctions] = useState(0)
  const [verified1, setVerified1] = useState("")
  const [verified2, setVerified2] = useState("")
  const [enteredBy, setEnteredBy] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError("")
    try {
      const next = await loadDigitalScoring(eventId)
      setData(next)
      setShootId((current) => current || next.shoots[0]?.id || "")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Scoring could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])

  const squads = useMemo(() => data?.squads.filter((row) => row.shoot_id === shootId) ?? [], [data, shootId])
  useEffect(() => { setSquadId((current) => squads.some((row) => row.id === current) ? current : squads[0]?.id || "") }, [squads])

  const members = useMemo(() => data?.members.filter((row) => row.squad_id === squadId) ?? [], [data, squadId])
  useEffect(() => { setMemberId((current) => members.some((row) => row.id === current) ? current : members[0]?.id || "") }, [members])

  const selectedSquad = data?.squads.find((row) => row.id === squadId)
  const suggestedCourse = data?.courses.find((row) => row.name === selectedSquad?.course_name) ?? data?.courses[0]
  useEffect(() => { setCourseId(suggestedCourse?.id || "") }, [suggestedCourse?.id])

  const stations = useMemo(() => data?.stations.filter((row) => row.course_id === courseId && row.bird_count > 0).sort((a, b) => a.display_order - b.display_order) ?? [], [data, courseId])
  const scorecard = data?.scorecards.find((row) => row.squad_member_id === memberId)
  const locked = scorecard?.status === "finalized"

  useEffect(() => {
    if (!data || !memberId) return
    const existing = scorecard
    const stationMap = new Map(data.stationScores.filter((row) => row.scorecard_id === existing?.id).map((row) => [row.station_id, String(row.hits)]))
    setScores(Object.fromEntries(stations.map((station) => [station.id, stationMap.get(station.id) ?? ""])))
    setMalfunctions(existing?.malfunction_count ?? 0)
    setVerified1(existing?.verified_by_1 ?? "")
    setVerified2(existing?.verified_by_2 ?? "")
    setEnteredBy(existing?.entered_by_name ?? "")
    setNotes(existing?.notes ?? "")
  }, [data, memberId, scorecard?.id, stations])

  const participant = useMemo(() => {
    if (!data || !memberId) return null
    const member = data.members.find((row) => row.id === memberId)
    const enrollment = data.enrollments.find((row) => row.id === member?.registration_shoot_id)
    const registration = data.registrations.find((row) => row.id === enrollment?.registration_id)
    const athlete = data.athletes.find((row) => row.id === registration?.athlete_id)
    const team = data.teams.find((row) => row.id === registration?.team_id)
    const cls = data.classes.find((row) => row.id === registration?.class_id)
    return { member, athlete, team, cls, registration }
  }, [data, memberId])

  const stationRows = stations.map((station) => {
    const raw = scores[station.id] ?? ""
    const parsed = raw === "" ? null : Number(raw)
    return { station, raw, parsed }
  })
  const enteredCount = stationRows.filter((row) => row.parsed !== null).length
  const totalScore = stationRows.reduce((sum, row) => sum + (row.parsed ?? 0), 0)
  const totalTargets = stations.reduce((sum, row) => sum + row.bird_count, 0)
  const invalid = stationRows.filter((row) => row.parsed !== null && (!Number.isInteger(row.parsed) || row.parsed < 0 || row.parsed > row.station.bird_count))

  async function save(status: "draft" | "finalized") {
    if (!data || !eventId || !shootId || !memberId || !courseId) return
    if (locked) { toast.error("This scorecard is finalized and locked."); return }
    if (invalid.length) { toast.error("Correct the highlighted station scores before saving."); return }
    if (status === "finalized" && enteredCount !== stations.length) { toast.error("Enter a score for every active station before finalizing."); return }
    if (status === "finalized" && !enteredBy.trim()) { toast.error("Entered by is required before finalizing."); return }

    setSaving(true)
    try {
      await saveDigitalScorecard({
        organizationId: data.event.organization_id,
        eventId,
        shootId,
        squadMemberId: memberId,
        courseId,
        scorecardId: scorecard?.id,
        malfunctionCount: malfunctions,
        verifiedBy1: verified1,
        verifiedBy2: verified2,
        enteredByName: enteredBy,
        notes,
        status,
        stationScores: stationRows.filter((row) => row.parsed !== null).map((row) => ({ stationId: row.station.id, hits: row.parsed as number, targets: row.station.bird_count })),
      })
      toast.success(status === "finalized" ? "Scorecard finalized and locked." : "Draft scorecard saved.")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Scorecard could not be saved.")
    } finally { setSaving(false) }
  }

  if (loading) return <PageContainer><div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading digital scoring…</div></PageContainer>
  if (!data) return <PageContainer><div className="rounded-xl border p-6">Scoring data is unavailable.</div></PageContainer>

  return <PageContainer><div className="space-y-6">
    <header className="rounded-2xl border bg-white p-6 shadow-sm">
      <Link to={`/events/${eventId}/operations`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="h-4 w-4" />Operations Center</Link>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-bold text-emerald-700">Tournament Scoring</p><h1 className="mt-1 text-3xl font-bold">Digital Score Entry</h1><p className="mt-2 text-sm text-slate-600">{data.event.name}</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</Button></div>
    </header>

    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

    <section className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-4">
      <Select label="Shoot" value={shootId} setValue={setShootId} options={data.shoots.map((row) => ({ value: row.id, label: row.name }))} />
      <Select label="Squad" value={squadId} setValue={setSquadId} options={squads.map((row) => ({ value: row.id, label: `Squad ${row.squad_number}` }))} />
      <Select label="Athlete / Post" value={memberId} setValue={setMemberId} options={members.map((member) => { const enrollment=data.enrollments.find((row)=>row.id===member.registration_shoot_id); const registration=data.registrations.find((row)=>row.id===enrollment?.registration_id); const athlete=data.athletes.find((row)=>row.id===registration?.athlete_id); return { value:member.id,label:`${member.position_label || `Post ${member.position}`} · ${nameOf(athlete)}` } })} />
      <Select label="Course" value={courseId} setValue={setCourseId} options={data.courses.map((row) => ({ value: row.id, label: row.name }))} />
    </section>

    {!memberId || !courseId ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">Select a shoot, squad, athlete, and course to begin scoring.</div> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Athlete" value={nameOf(participant?.athlete)} detail={participant?.team?.name || "No team"} />
        <Summary label="Squad / Post" value={`Squad ${selectedSquad?.squad_number ?? "—"}`} detail={participant?.member?.position_label || `Post ${participant?.member?.position ?? "—"}`} />
        <Summary label="Score" value={`${totalScore} / ${totalTargets}`} detail={`${enteredCount} of ${stations.length} stations entered`} />
        <Summary label="Status" value={locked ? "Finalized" : scorecard ? "Draft" : "Not Started"} detail={locked ? "Locked from editing" : "Editable"} />
      </section>

      {locked ? <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Lock className="h-5 w-5" />This scorecard was finalized and is locked.</div> : null}
      {invalid.length ? <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><CircleAlert className="h-5 w-5" />One or more station scores exceed the configured number of birds.</div> : null}

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Station</th><th className="p-4">Available Birds</th><th className="p-4">Hits</th><th className="p-4">Misses</th><th className="p-4">Running Total</th><th className="p-4">Notes</th></tr></thead><tbody className="divide-y">
          {stationRows.map((row, index) => { const running=stationRows.slice(0,index+1).reduce((sum,item)=>sum+(item.parsed??0),0); const bad=row.parsed!==null && (row.parsed<0 || row.parsed>row.station.bird_count || !Number.isInteger(row.parsed)); return <tr key={row.station.id}><td className="p-4 font-bold">{row.station.station_number}</td><td className="p-4">{row.station.bird_count}</td><td className="p-4"><input disabled={locked} inputMode="numeric" value={row.raw} onChange={(event)=>setScores((current)=>({...current,[row.station.id]:event.target.value.replace(/[^0-9]/g,"")}))} className={`h-11 w-24 rounded-lg border px-3 text-center text-lg font-bold ${bad?"border-red-400 bg-red-50":""}`} /></td><td className="p-4">{row.parsed===null?"—":row.station.bird_count-row.parsed}</td><td className="p-4 text-lg font-bold">{running}</td><td className="p-4 text-slate-500">{row.station.notes || "—"}</td></tr> })}
        </tbody></table></div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label><span className="text-sm font-semibold">Malfunctions (0–3)</span><input disabled={locked} type="number" min={0} max={3} value={malfunctions} onChange={(e)=>setMalfunctions(Math.min(3,Math.max(0,Number(e.target.value))))} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
        <Field label="Verified by #1" value={verified1} setValue={setVerified1} disabled={locked} />
        <Field label="Verified by #2" value={verified2} setValue={setVerified2} disabled={locked} />
        <Field label="Entered by" value={enteredBy} setValue={setEnteredBy} disabled={locked} />
        <label className="md:col-span-2 xl:col-span-4"><span className="text-sm font-semibold">Notes</span><textarea disabled={locked} value={notes} onChange={(e)=>setNotes(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border p-3" /></label>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={()=>void save("draft")} disabled={saving || locked}><Save className="h-4 w-4" />Save Draft</Button>
        <Button onClick={()=>void save("finalized")} disabled={saving || locked || stations.length===0}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}Finalize Scorecard</Button>
      </div>
    </>}
  </div></PageContainer>
}

function Select(props:{label:string;value:string;setValue:(value:string)=>void;options:Array<{value:string;label:string}>}){return <label><span className="text-sm font-semibold">{props.label}</span><select value={props.value} onChange={(e)=>props.setValue(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"><option value="">Select…</option>{props.options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
function Field(props:{label:string;value:string;setValue:(value:string)=>void;disabled:boolean}){return <label><span className="text-sm font-semibold">{props.label}</span><input disabled={props.disabled} value={props.value} onChange={(e)=>props.setValue(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>}
function Summary(props:{label:string;value:string;detail:string}){return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{props.label}</p><p className="mt-1 text-xl font-black">{props.value}</p><p className="mt-1 text-xs text-slate-500">{props.detail}</p></div>}
