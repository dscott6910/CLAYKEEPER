import { useEffect, useMemo, useState } from "react"
import { Archive, CalendarPlus, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { importUsOpenWorkbook, parseUsOpenWorkbook, type ParsedUsOpenWorkbook } from "@/lib/services/historicalImport"
import { activateSeason, closeSeason, createSeason, listSeasons, type Season } from "@/lib/services/seasons"

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

export function SeasonImportPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<ParsedUsOpenWorkbook | null>(null)
  const [seasonName, setSeasonName] = useState("2026 Season")
  const [seasonStart, setSeasonStart] = useState("2026-01-01")
  const [seasonEnd, setSeasonEnd] = useState("2026-12-31")
  const [seasonId, setSeasonId] = useState("")
  const [eventName, setEventName] = useState("2026 US Open")
  const [shootDate, setShootDate] = useState("2026-01-01")
  const [locationName, setLocationName] = useState("")
  const [trapEntryFee, setTrapEntryFee] = useState("140")
  const [skeetEntryFee, setSkeetEntryFee] = useState("130")
  const [sportingEntryFee, setSportingEntryFee] = useState("130")
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
    const rows = parsed?.sheets.flatMap((sheet) => sheet.rows) ?? []
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
      const result = await parseUsOpenWorkbook(file)
      setParsed(result)
      const rowCount = result.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)
      toast.success(`${rowCount} discipline entries found across ${result.sheets.length} worksheets`)
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
      const result = await importUsOpenWorkbook(parsed, {
        seasonId,
        eventName,
        eventDate: shootDate,
        locationName,
        trapEntryFee: Number(trapEntryFee) || 0,
        skeetEntryFee: Number(skeetEntryFee) || 0,
        sportingEntryFee: Number(sportingEntryFee) || 0,
        organizationFee: Number(organizationFee) || 0,
      })
      toast.success(`${result.uniqueParticipants} participants and ${result.importedRows} discipline entries imported into ${eventName}`)
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">2026 US Open workbook import</h2>
                <p className="mt-1 text-sm text-slate-600">Imports the SKEET, SPORTING CLAYS, and TRAP worksheets as three shoots inside one event. Trap 1–8 and Skeet round scores are preserved, while Sporting Clays uses the worksheet total.</p>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            </div>
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-emerald-500 hover:bg-emerald-50/40">
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-emerald-600" /> : <Upload className="h-8 w-8 text-emerald-600" />}
              <span className="mt-3 font-medium text-slate-800">Choose REVISED US OPEN 2026 SCORES.xlsx</span>
              <span className="mt-1 text-xs text-slate-500">ClayKeeper reads all three discipline worksheets and ignores the formatted blank rows.</span>
              <input className="hidden" type="file" accept=".xlsx,.xls" onChange={(e) => void handleFile(e.target.files?.[0])} />
            </label>

            {parsed && <>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[['Entries', totals.rows], ['Ready', totals.ready], ['Warnings', totals.warnings], ['Errors', totals.errors]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {parsed.sheets.map((sheet) => <div key={sheet.sheetName} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><strong>{sheet.sheetName}</strong><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{sheet.rows.length} entries</span></div><p className="mt-2 text-xs text-slate-500">{sheet.roundLabels.length ? `${sheet.roundLabels.length} score rounds detected` : 'Total-score import'}</p></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <select className={input} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}><option value="">Select season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select>
                <input className={input} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" />
                <input className={input} type="date" value={shootDate} onChange={(e) => setShootDate(e.target.value)} />
                <input className={input} value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Location (optional)" />
                <input className={input} type="number" min="0" step="0.01" value={trapEntryFee} onChange={(e) => setTrapEntryFee(e.target.value)} placeholder="Trap fee" />
                <input className={input} type="number" min="0" step="0.01" value={skeetEntryFee} onChange={(e) => setSkeetEntryFee(e.target.value)} placeholder="Skeet fee" />
                <input className={input} type="number" min="0" step="0.01" value={sportingEntryFee} onChange={(e) => setSportingEntryFee(e.target.value)} placeholder="Sporting Clays fee" />
                <input className={input} type="number" min="0" step="0.01" value={organizationFee} onChange={(e) => setOrganizationFee(e.target.value)} placeholder="Organization/CYSSA fee" />
              </div>

              <div className="mt-5 max-h-[520px] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Sheet</th><th className="px-3 py-2">Row</th><th className="px-3 py-2">Participant</th><th className="px-3 py-2">Team</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Squad</th><th className="px-3 py-2">Scores / Total</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody>{parsed.sheets.flatMap((sheet) => sheet.rows.map((row) => <tr key={`${sheet.sheetName}-${row.rowNumber}`} className="border-t border-slate-100"><td className="px-3 py-2 font-medium">{sheet.sheetName}</td><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.firstName} {row.lastName}</td><td className="px-3 py-2">{row.team || '—'}</td><td className="px-3 py-2">{row.classCode || '—'}</td><td className="px-3 py-2">{row.squadNumber || '—'}</td><td className="px-3 py-2 whitespace-nowrap">{row.scores.some((score) => score !== null) ? row.scores.map((score) => score ?? '—').join(' · ') : `Total ${row.total ?? '—'}`}</td><td className="px-3 py-2">{row.resultNote || '—'}</td><td className="px-3 py-2">{row.errors.length ? <span className="inline-flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" />{row.errors[0]}</span> : row.warnings.length ? <span className="text-amber-600">{row.warnings[0]}</span> : <span className="inline-flex items-center text-emerald-600"><CheckCircle2 className="mr-1 h-4 w-4" />Ready</span>}</td></tr>))}</tbody>
                </table>
              </div>
              <div className="mt-5 flex justify-end"><Button onClick={handleImport} disabled={busy || totals.errors > 0 || !seasonId || !eventName || !shootDate}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Import complete US Open</Button></div>
            </>}
          </section>
        </div>
      </PageContainer>
    </div>
  )
}
