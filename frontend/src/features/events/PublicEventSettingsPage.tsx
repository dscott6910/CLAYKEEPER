import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Copy, ExternalLink, Loader2, Save } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { loadPublicEventSettings, savePublicEventSettings } from "@/lib/services/publicEventPortal"

export function PublicEventSettingsPage() {
  const { eventId } = useParams()
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPublicEventSettings>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [showLiveScores, setShowLiveScores] = useState(false)
  const [showSquads, setShowSquads] = useState(true)
  const [showTeams, setShowTeams] = useState(true)
  const [showAwards, setShowAwards] = useState(true)
  const [displayModeEnabled, setDisplayModeEnabled] = useState(true)
  const [publicMessage, setPublicMessage] = useState("")

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const next = await loadPublicEventSettings(eventId)
      setData(next)
      setIsPublic(next.settings?.is_public ?? false)
      setShowLiveScores(next.settings?.show_live_scores ?? false)
      setShowSquads(next.settings?.show_squads ?? true)
      setShowTeams(next.settings?.show_teams ?? true)
      setShowAwards(next.settings?.show_awards ?? true)
      setDisplayModeEnabled(next.settings?.display_mode_enabled ?? true)
      setPublicMessage(next.settings?.public_message ?? "")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Public settings could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!data || !eventId) return
    setSaving(true)
    try {
      const selectedEvent = data?.event

      if (!selectedEvent) {
        throw new Error("Public event settings are unavailable.")
      }

      await savePublicEventSettings({ organizationId: selectedEvent.organization_id, eventId, isPublic, showLiveScores, showSquads, showTeams, showAwards, displayModeEnabled, publicMessage })
      toast.success("Public settings saved.")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Public settings could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  async function setPublicAccess(nextIsPublic: boolean) {
    if (!data || !eventId) return

    const selectedEvent = data.event
    if (!selectedEvent) {
      toast.error("Public event settings are unavailable.")
      return
    }

    setSaving(true)
    try {
      await savePublicEventSettings({
        organizationId: selectedEvent.organization_id,
        eventId,
        isPublic: nextIsPublic,
        showLiveScores,
        showSquads,
        showTeams,
        showAwards,
        displayModeEnabled,
        publicMessage,
      })

      setIsPublic(nextIsPublic)
      toast.success(nextIsPublic ? "Public event page is open." : "Public event page is closed.")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Public access could not be changed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageContainer><div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading public portal settings…</div></PageContainer>
  if (!data || !eventId) return <PageContainer><div className="rounded-2xl border bg-white p-8">Public settings are unavailable.</div></PageContainer>

  const publicUrl = `${window.location.origin}/public/events/${eventId}`

  return <PageContainer><div className="space-y-6">
    <header className="rounded-2xl border bg-white p-6 shadow-sm"><Link to={`/events/${eventId}/operations`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="h-4 w-4" />Operations Center</Link><div className="mt-4"><p className="text-sm font-bold text-emerald-700">Spectator Experience</p><h1 className="mt-1 text-3xl font-bold">Public Event Portal</h1><p className="mt-2 text-slate-600">{data.event?.name ?? "Event"}</p></div></header>

    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-bold">Public access</h2><p className="mt-1 text-sm text-slate-500">Open or close the event page without redeploying ClayKeeper.</p></div><div className="flex items-center gap-3">
        <span className={`rounded-full px-4 py-2 text-sm font-bold ${isPublic ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {isPublic ? "Public page open" : "Public page closed"}
        </span>
        <Button
          type="button"
          onClick={() => void setPublicAccess(!isPublic)}
          disabled={saving}
          className={isPublic ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isPublic ? "Close Public Page" : "Open Public Page"}
        </Button>
      </div></div>
      <div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(publicUrl); toast.success("Public link copied.") }}><Copy className="h-4 w-4" />Copy Link</Button><a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="h-4 w-4" />Preview Page</Button></a>{displayModeEnabled ? <a href={`${publicUrl}?display=1`} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="h-4 w-4" />Preview Display</Button></a> : null}</div>
    </section>

    <section className="grid gap-4 md:grid-cols-2"><Toggle label="Show live scores" detail="Display draft and finalized digital scorecards as they arrive." value={showLiveScores} setValue={setShowLiveScores} /><Toggle label="Show squad details" detail="Display squad, post, course, and start-time information." value={showSquads} setValue={setShowSquads} /><Toggle label="Show team standings" detail="Display team totals using the top five visible athletes." value={showTeams} setValue={setShowTeams} /><Toggle label="Show published awards" detail="Display official results after awards are published." value={showAwards} setValue={setShowAwards} /><Toggle label="Enable clubhouse display" detail="Allow the large-screen display-mode URL." value={displayModeEnabled} setValue={setDisplayModeEnabled} /></section>

    <section className="rounded-2xl border bg-white p-6 shadow-sm"><label><span className="font-semibold">Public announcement</span><textarea value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} placeholder="Schedule changes, weather notes, awards timing, or other spectator information" className="mt-2 min-h-28 w-full rounded-xl border p-3" /></label></section>

    <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Public Settings</Button></div>
  </div></PageContainer>
}

function Toggle(props: { label: string; detail: string; value: boolean; setValue: (value: boolean) => void }) {
  return <button type="button" onClick={() => props.setValue(!props.value)} className={`rounded-2xl border p-5 text-left shadow-sm ${props.value ? "border-emerald-300 bg-emerald-50" : "bg-white"}`}><div className="flex items-center justify-between gap-4"><div><h3 className="font-bold">{props.label}</h3><p className="mt-1 text-sm text-slate-500">{props.detail}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${props.value ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{props.value ? "On" : "Off"}</span></div></button>
}
