import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Copy, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { DISCIPLINE_OPTIONS, getDisciplineLabel } from "@/lib/constants/disciplines"
import {
  deleteEventCourse,
  loadCourseBuilderData,
  saveEventCourse,
  type CourseSide,
  type CourseStation,
  type EventCourse,
} from "@/lib/services/courseBuilder"

type StationForm = { stationNumber: number; birdCount: number; notes: string; targetType: string }
type CourseForm = { id: string | null; name: string; discipline: string; courseSide: CourseSide; templateName: string; stations: StationForm[] }

const COURSE_SIDES: CourseSide[] = ["East", "West", "Custom"]
const MAX_BIRDS_PER_STATION = 14
const blankStations = () => Array.from({ length: 15 }, (_, index) => ({ stationNumber: index + 1, birdCount: MAX_BIRDS_PER_STATION, notes: "", targetType: "" }))
const blankForm = (discipline = "sporting_clays"): CourseForm => ({ id: null, name: "East Course", discipline, courseSide: "East", templateName: "", stations: blankStations() })

function courseToForm(course: EventCourse, stations: CourseStation[]): CourseForm {
  const byNumber = new Map(stations.filter((station) => station.course_id === course.id).map((station) => [station.station_number, station]))
  return {
    id: course.id,
    name: course.name,
    discipline: course.discipline,
    courseSide: course.course_side,
    templateName: course.template_name ?? "",
    stations: Array.from({ length: 15 }, (_, index) => {
      const stationNumber = index + 1
      const station = byNumber.get(stationNumber)
      return { stationNumber, birdCount: station?.bird_count ?? 0, notes: station?.notes ?? "", targetType: station?.target_type ?? "" }
    }),
  }
}

export function CourseBuilderPage() {
  const { eventId } = useParams()
  const [organizationId, setOrganizationId] = useState("")
  const [eventName, setEventName] = useState("")
  const [eventDiscipline, setEventDiscipline] = useState<string | null>(null)
  const [courses, setCourses] = useState<EventCourse[]>([])
  const [stations, setStations] = useState<CourseStation[]>([])
  const [form, setForm] = useState<CourseForm>(() => blankForm())
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [applyBirdCount, setApplyBirdCount] = useState(MAX_BIRDS_PER_STATION)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true); setError("")
    try {
      const data = await loadCourseBuilderData(eventId)
      setOrganizationId(data.event.organization_id); setEventName(data.event.name); setEventDiscipline(data.event.discipline)
      setCourses(data.courses); setStations(data.stations)
      const nextId = selectedCourseId && data.courses.some((course) => course.id === selectedCourseId) ? selectedCourseId : data.courses[0]?.id ?? ""
      setSelectedCourseId(nextId)
      const selected = data.courses.find((course) => course.id === nextId)
      setForm(selected ? courseToForm(selected, data.stations) : blankForm(data.event.discipline ?? "sporting_clays"))
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load the course builder.") }
    finally { setLoading(false) }
  }, [eventId, selectedCourseId])

  useEffect(() => { void load() }, [load])
  const totalBirds = useMemo(() => form.stations.reduce((total, station) => total + station.birdCount, 0), [form.stations])

  function chooseCourse(courseId: string) {
    setSelectedCourseId(courseId)
    const course = courses.find((row) => row.id === courseId)
    if (course) setForm(courseToForm(course, stations))
  }
  function newCourse() { setSelectedCourseId(""); setForm(blankForm(eventDiscipline ?? "sporting_clays")); setSuccess(""); setError("") }
  function duplicateCourse() { setSelectedCourseId(""); setForm((current) => ({ ...current, id: null, name: `${current.name} Copy` })); setSuccess("") }
  function updateStation(stationNumber: number, changes: Partial<StationForm>) { setForm((current) => ({ ...current, stations: current.stations.map((station) => station.stationNumber === stationNumber ? { ...station, ...changes } : station) })) }
  function applyToAllStations() { setForm((current) => ({ ...current, stations: current.stations.map((station) => ({ ...station, birdCount: applyBirdCount })) })) }

  async function save() {
    if (!eventId || !organizationId) return
    if (!form.name.trim()) { setError("Course name is required."); return }
    setSaving(true); setError(""); setSuccess("")
    try {
      const courseId = await saveEventCourse({ organizationId, eventId, courseId: form.id, name: form.name, discipline: form.discipline, courseSide: form.courseSide, templateName: form.templateName || null, stations: form.stations })
      setSelectedCourseId(courseId); setSuccess("Course saved successfully."); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The course could not be saved.") }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!form.id || !organizationId || !window.confirm(`Delete "${form.name}" and all 15 station settings?`)) return
    setSaving(true); setError("")
    try { await deleteEventCourse(organizationId, form.id); setSelectedCourseId(""); setSuccess("Course deleted."); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The course could not be deleted.") }
    finally { setSaving(false) }
  }

  if (loading) return <PageContainer><div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading course builder…</div></PageContainer>

  return <PageContainer><div className="space-y-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <Link to={`/events/${eventId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/>Event Workspace</Link>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Course Builder</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{eventName}</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Configure exactly 15 stations. Each station may contain zero to fourteen scoring birds.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={saving}><RefreshCw className="h-4 w-4"/>Refresh</Button><Button variant="outline" onClick={newCourse}><Plus className="h-4 w-4"/>New Course</Button></div></div>
    </header>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}
    <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-4"><h2 className="font-bold text-slate-950">Event Courses</h2><p className="mt-1 text-sm text-slate-500">East, West, or custom layouts.</p></div><div className="space-y-2 p-3">{courses.map((course) => <button key={course.id} type="button" onClick={() => chooseCourse(course.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedCourseId === course.id ? "border-slate-950 bg-slate-950 text-white" : "hover:bg-slate-50"}`}><div className="font-semibold">{course.name}</div><div className={`mt-1 text-xs ${selectedCourseId === course.id ? "text-slate-300" : "text-slate-500"}`}>{course.course_side} · {getDisciplineLabel(course.discipline)}</div></button>)}{courses.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">No courses have been created.</div> : null}</div></aside>
      <main className="space-y-5">
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label><span className="text-sm font-semibold">Course name</span><input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"/></label>
          <label><span className="text-sm font-semibold">Discipline</span><select value={form.discipline} onChange={(e) => setForm((c) => ({ ...c, discipline: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm">{DISCIPLINE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span className="text-sm font-semibold">Course side</span><select value={form.courseSide} onChange={(e) => setForm((c) => ({ ...c, courseSide: e.target.value as CourseSide }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm">{COURSE_SIDES.map((side) => <option key={side} value={side}>{side}</option>)}</select></label>
          <label><span className="text-sm font-semibold">Template name</span><input value={form.templateName} onChange={(e) => setForm((c) => ({ ...c, templateName: e.target.value }))} placeholder="Optional" className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"/></label>
        </div><div className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between"><label><span className="text-sm font-semibold">Apply bird count to all stations</span><select value={applyBirdCount} onChange={(e) => setApplyBirdCount(Number(e.target.value))} className="mt-1 min-h-10 rounded-lg border bg-white px-3 text-sm">{Array.from({ length: MAX_BIRDS_PER_STATION + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></label><Button variant="outline" onClick={applyToAllStations}>Apply to All 15 Stations</Button></div></section>
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold text-slate-950">Station Configuration</h2><p className="mt-1 text-sm text-slate-500">A bird count of zero disables that station on printed scorecards.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Station</th><th className="px-5 py-3">Birds</th><th className="px-5 py-3">Target Type</th><th className="px-5 py-3">Notes</th></tr></thead><tbody className="divide-y">{form.stations.map((station) => <tr key={station.stationNumber}><td className="px-5 py-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold">{station.stationNumber}</span></td><td className="px-5 py-3"><select value={station.birdCount} onChange={(e) => updateStation(station.stationNumber, { birdCount: Number(e.target.value) })} className="min-h-10 w-24 rounded-lg border bg-white px-3 font-semibold">{Array.from({ length: MAX_BIRDS_PER_STATION + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></td><td className="px-5 py-3"><input value={station.targetType} onChange={(e) => updateStation(station.stationNumber, { targetType: e.target.value })} placeholder="Rabbit, pair, crossing…" className="min-h-10 w-full rounded-lg border px-3"/></td><td className="px-5 py-3"><input value={station.notes} onChange={(e) => updateStation(station.stationNumber, { notes: e.target.value })} placeholder="Optional station notes" className="min-h-10 w-full rounded-lg border px-3"/></td></tr>)}</tbody></table></div>
          <div className="flex flex-col gap-4 border-t bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-6"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Stations</p><p className="text-2xl font-bold">15</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Birds</p><p className="text-2xl font-bold">{totalBirds}</p></div></div><div className="flex flex-wrap gap-2">{form.id ? <><Button variant="outline" onClick={duplicateCourse} disabled={saving}><Copy className="h-4 w-4"/>Duplicate</Button><Button variant="outline" onClick={() => void remove()} disabled={saving} className="text-red-700"><Trash2 className="h-4 w-4"/>Delete</Button></> : null}<Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Save Course</Button></div></div>
        </section>
      </main>
    </section>
  </div></PageContainer>
}
