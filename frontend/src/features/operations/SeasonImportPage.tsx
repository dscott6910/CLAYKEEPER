import { useEffect, useMemo, useState } from "react"
import { Archive, CalendarPlus, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { importHistoricalShoot, parseHistoricalWorkbook, type ParsedWorkbook } from "@/lib/services/historicalImport"
import { activateSeason, closeSeason, createSeason, listSeasons, type Season } from "@/lib/services/seasons"

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

export function SeasonImportPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null)
  const [seasonName, setSeasonName] = useState("2026 Season")
  const [seasonStart, setSeasonStart] = useState("2026-01-01")
  const [seasonEnd, setSeasonEnd] = useState("2026-12-31")
  const [seasonId, setSeasonId] = useState("")
  const [eventName, setEventName] = useState("2026 US Open")
  const [shootName, setShootName] = useState("2026 US Open")
  const [shootDate, setShootDate] = useState("2026-01-01")
  const [locationName, setLocationName] = useState("")
  const [discipline, setDiscipline] = useState<"american_trap" | "skeet" | "sporting_clays" | "bunker">("american_trap")
  const [entryFee, setEntryFee] = useState("0")
  const [organizationFee, setOrganizationFee] = useState("0")

  async function refresh() {
    setLoading(true)
    try {
      const data = await listSeasons()
      setSeasons(data)
      setSeasonId((current) => current || data.find((s) => s.status === "active")?.id || data[0]?.id || "")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load seasons")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const totals = useMemo(() => {
    const rows = parsed?.rows ?? []
    return {
      rows: rows.length,
      ready: rows.filter((r) => !r.errors.length).length,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0),
      errors: rows.reduce((sum, row) => sum + row.errors.length, 0),
    }
  }, [parsed])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const result = await parseHistoricalWorkbook(file)
      setParsed(result)
      toast.success(`${result.rows.length} participant rows found in ${result.sheetName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read workbook")
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateSeason() {
    setBusy(true)
    try {
      const id = await createSeason({ name: seasonName, startDate: seasonStart, endDate: seasonEnd, makeActive: seasons.every((s) => s.status !== "active") })
      await refresh()
      setSeasonId(id)
      toast.success(`${seasonName} created`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create season")
    } finally { setBusy(false) }
  }

  async function handleClose(season: Season) {
    if (!window.confirm(`Close ${season.name}? Its events will be archived and become read-only in normal event workflows.`)) return
    setBusy(true)
    try { await closeSeason(season.id); await refresh(); toast.success(`${season.name} closed`) }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to close season") }
    finally { setBusy(false) }
  }

  async function handleActivate(season: Season) {
    setBusy(true)
    try { await activateSeason(season.id); await refresh(); setSeasonId(season.id); toast.success(`${season.name} is now active`) }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to activate season") }
    finally { setBusy(false) }
  }

  async function handleImport() {
    if (!parsed || !seasonId) return
    setBusy(true)
    try {
      const result = await importHistoricalShoot(parsed, {
        seasonId,
        eventName,
        shootName,
        shootDate,
        discipline,
        locationName,
        entryFee: Number(entryFee) || 0,
        organizationFee: Number(organizationFee) || 0,
      })
      toast.success(`${result.imported} participants imported into ${eventName}`)
      setParsed(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed")
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title="Seasons & Historical Import" description="Close completed seasons, start a new season, and populate past shoots from Excel." />
      <PageContainer>
        <div className="space-y-6">
          <section className={card}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold text-slate-900">Season management</h2><p className="mt-1 text-sm text-slate-600">Only one season can be active. Closing a season archives its events without deleting scores or financial history.</p></div>
              <Archive className="h-6 w-6 text-slate-400" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <input className={input} value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="Season name" />
              <input className={input} type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
              <input className={input} type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
              <Button onClick={handleCreateSeason} disabled={busy || !seasonName || !seasonStart || !seasonEnd}><CalendarPlus className="mr-2 h-4 w-4" />Create season</Button>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {loading ? <p className="text-sm text-slate-500">Loading seasons…</p> : seasons.map((season) => (
                <div key={season.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3"><strong>{season.name}</strong><span className={`rounded-full px-2 py-1 text-xs font-semibold ${season.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{season.status}</span></div>
                  <p className="mt-2 text-xs text-slate-500">{season.start_date} through {season.end_date}</p>
                  <div className="mt-4 flex gap-2">
                    {season.status !== "active" && season.status !== "closed" && <Button variant="outline" size="sm" onClick={() => handleActivate(season)} disabled={busy}>Make active</Button>}
                    {season.status === "active" && <Button variant="outline" size="sm" onClick={() => handleClose(season)} disabled={busy}>Close season</Button>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={card}>
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Historical shoot upload</h2><p className="mt-1 text-sm text-slate-600">Upload .xlsx, .xls, or .csv. ClayKeeper detects common participant, team, class, squad, post, round, total, and payment columns.</p></div><FileSpreadsheet className="h-6 w-6 text-emerald-600" /></div>
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-emerald-500 hover:bg-emerald-50/40">
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-emerald-600" /> : <Upload className="h-8 w-8 text-emerald-600" />}
              <span className="mt-3 font-medium text-slate-800">Choose the 2026 US Open workbook</span><span className="mt-1 text-xs text-slate-500">The first worksheet is used for this initial importer.</span>
              <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void handleFile(e.target.files?.[0])} />
            </label>

            {parsed && <>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[['Rows', totals.rows], ['Ready', totals.ready], ['Warnings', totals.warnings], ['Errors', totals.errors]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <select className={input} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}><option value="">Select season</option>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}</select>
                <input className={input} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" />
                <input className={input} value={shootName} onChange={(e) => setShootName(e.target.value)} placeholder="Shoot name" />
                <input className={input} type="date" value={shootDate} onChange={(e) => setShootDate(e.target.value)} />
                <select className={input} value={discipline} onChange={(e) => setDiscipline(e.target.value as typeof discipline)}><option value="american_trap">American Trap</option><option value="skeet">Skeet</option><option value="sporting_clays">Sporting Clays</option><option value="bunker">Bunker</option></select>
                <input className={input} value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Location (optional)" />
                <input className={input} type="number" min="0" step="0.01" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} placeholder="Entry fee" />
                <input className={input} type="number" min="0" step="0.01" value={organizationFee} onChange={(e) => setOrganizationFee(e.target.value)} placeholder="Organization/CYSSA fee" />
              </div>

              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Participant</th><th className="px-3 py-2">Team</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Squad/Post</th><th className="px-3 py-2">Rounds</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody>{parsed.rows.slice(0, 50).map((row) => <tr key={row.rowNumber} className="border-t border-slate-100"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.firstName} {row.lastName}</td><td className="px-3 py-2">{row.team || '—'}</td><td className="px-3 py-2">{row.classCode || '—'}</td><td className="px-3 py-2">{row.squadNumber || '—'} / {row.post ?? '—'}</td><td className="px-3 py-2">{row.scores.map((s) => s ?? '—').join(' · ')}</td><td className="px-3 py-2">{row.errors.length ? <span className="inline-flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" />{row.errors[0]}</span> : row.warnings.length ? <span className="text-amber-600">{row.warnings[0]}</span> : <span className="inline-flex items-center text-emerald-600"><CheckCircle2 className="mr-1 h-4 w-4" />Ready</span>}</td></tr>)}</tbody>
                </table>
              </div>
              {parsed.rows.length > 50 && <p className="mt-2 text-xs text-slate-500">Showing the first 50 of {parsed.rows.length} rows.</p>}
              <div className="mt-5 flex justify-end"><Button onClick={handleImport} disabled={busy || totals.errors > 0 || !seasonId || !eventName || !shootName || !shootDate}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Import historical shoot</Button></div>
            </>}
          </section>
        </div>
      </PageContainer>
    </div>
  )
}
