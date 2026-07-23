import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, CloudOff, CloudUpload, Loader2, MapPin, RefreshCw, Search, Smartphone, Target, UserCheck, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { getQueuedCheckIns, loadMobileOperations, syncQueuedCheckIns, updateCheckIn, type MobileOperationsData } from "@/lib/services/mobileOperations"

function formatTime(value: string | null) {
  if (!value) return "Time not set"
  const [hours, minutes] = value.split(":")
  const date = new Date(); date.setHours(Number(hours), Number(minutes))
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function MobileOperationsPage() {
  const [data, setData] = useState<MobileOperationsData | null>(null)
  const [eventId, setEventId] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [online, setOnline] = useState(navigator.onLine)
  const [queuedCount, setQueuedCount] = useState(getQueuedCheckIns().length)

  const refresh = useCallback(async (requested?: string) => {
    setLoading(true)
    try {
      const next = await loadMobileOperations(requested || eventId || undefined)
      setData(next)
      setEventId(next.selectedEvent?.id ?? "")
      setQueuedCount(getQueuedCheckIns().length)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load mobile operations.")
    } finally { setLoading(false) }
  }, [eventId])

  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    const onOnline = async () => {
      setOnline(true)
      const synced = await syncQueuedCheckIns()
      if (synced) toast.success(`${synced} offline change${synced === 1 ? "" : "s"} synchronized.`)
      void refresh()
    }
    const onOffline = () => setOnline(false)
    const onQueue = () => setQueuedCount(getQueuedCheckIns().length)
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener("claykeeper-queue-change", onQueue)
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("claykeeper-queue-change", onQueue) }
  }, [refresh])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return data?.participants ?? []
    return (data?.participants ?? []).filter((participant) => [participant.name, participant.team, participant.registrationNumber, participant.classCode, ...participant.squads.flatMap((squad) => [squad.squadNumber, squad.shootName, squad.location])].some((value) => String(value).toLowerCase().includes(needle)))
  }, [data, query])

  const checkedIn = data?.participants.filter((participant) => participant.checkedIn).length ?? 0

  async function toggleCheckIn(registrationId: string, checked: boolean) {
    setBusyId(registrationId)
    const result = await updateCheckIn(registrationId, checked)
    setData((current) => current ? { ...current, participants: current.participants.map((participant) => participant.registrationId === registrationId ? { ...participant, checkedIn: checked } : participant) } : current)
    setQueuedCount(getQueuedCheckIns().length)
    toast[result.queued ? "info" : "success"](result.queued ? "Saved offline. It will sync automatically." : checked ? "Participant checked in." : "Check-in removed.")
    setBusyId("")
  }

  return (
    <PageContainer>
      <div className="mb-5"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mobile Tournament Operations</h1><p className="mt-1 text-sm text-slate-600 sm:text-base">Fast check-in and squad lookup for phones and tablets.</p></div>
      <div className="mx-auto max-w-5xl space-y-4 pb-24">
        <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${online ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <span className="flex items-center gap-2">{online ? <CloudUpload className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}{online ? "Online and ready to sync" : "Offline mode — changes are stored on this device"}</span>
          {queuedCount > 0 && <span className="rounded-full bg-white px-2 py-1 text-xs">{queuedCount} queued</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Participants</div><div className="mt-1 text-3xl font-bold">{data?.participants.length ?? 0}</div></div>
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checked in</div><div className="mt-1 text-3xl font-bold text-emerald-700">{checkedIn}</div></div>
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</div><div className="mt-1 text-3xl font-bold text-amber-700">{Math.max(0, (data?.participants.length ?? 0) - checkedIn)}</div></div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select value={eventId} onChange={(event) => { setEventId(event.target.value); void refresh(event.target.value) }} className="h-12 rounded-xl border border-slate-300 bg-white px-3 font-medium">
              {(data?.events ?? []).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
            <Button variant="outline" className="h-12" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
          </div>
          <div className="relative mt-3"><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, team, squad, post, or registration number" className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-base" /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/scoring" className="flex min-h-20 items-center gap-3 rounded-2xl bg-slate-950 p-4 font-semibold text-white"><Target className="h-6 w-6" />Open scoring</Link>
          <Link to="/squads" className="flex min-h-20 items-center gap-3 rounded-2xl bg-white p-4 font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200"><Users className="h-6 w-6" />Manage squads</Link>
        </div>

        {loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-700" /></div> : (
          <div className="space-y-3">
            {filtered.map((participant) => (
              <article key={participant.registrationId} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0"><h2 className="truncate text-lg font-bold">{participant.name}</h2><p className="text-sm text-slate-600">{participant.team} · {participant.classCode} · #{participant.registrationNumber}</p></div>
                  <button onClick={() => void toggleCheckIn(participant.registrationId, !participant.checkedIn)} disabled={busyId === participant.registrationId} className={`min-h-12 shrink-0 rounded-xl px-4 text-sm font-bold ${participant.checkedIn ? "bg-emerald-100 text-emerald-800" : "bg-slate-950 text-white"}`}>
                    {busyId === participant.registrationId ? <Loader2 className="h-5 w-5 animate-spin" /> : participant.checkedIn ? <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Checked in</span> : <span className="flex items-center gap-2"><UserCheck className="h-5 w-5" />Check in</span>}
                  </button>
                </div>
                <div className="border-t bg-slate-50 p-4">
                  {participant.squads.length ? <div className="space-y-2">{participant.squads.map((squad, index) => <div key={`${squad.shootName}-${index}`} className="grid gap-1 rounded-xl border bg-white p-3 text-sm sm:grid-cols-4"><strong>{squad.shootName}</strong><span>Squad {squad.squadNumber}</span><span>Post {squad.post ?? "—"}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{squad.location} · {formatTime(squad.startTime)}</span></div>)}</div> : <p className="text-sm font-medium text-amber-700">No squad assignment yet.</p>}
                </div>
              </article>
            ))}
            {!filtered.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">No participants match this search.</div>}
          </div>
        )}
      </div>
      <div className="fixed bottom-4 right-4 hidden items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-lg sm:flex"><Smartphone className="h-4 w-4" />Mobile-ready workspace</div>
    </PageContainer>
  )
}
