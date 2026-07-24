import { useEffect, useMemo, useState } from "react"
import { Archive, CalendarPlus, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { importTrapSeriesWorkbook, importUsOpenWorkbook, parseTrapSeriesWorkbook, parseUsOpenWorkbook, type ParsedTrapSeriesWorkbook, type ParsedUsOpenWorkbook } from "@/lib/services/historicalImport"
import { activateSeason, closeSeasonAndRollover, createSeason, listSeasons, type Season, type SeasonCloseoutSummary } from "@/lib/services/seasons"

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

export function SeasonImportPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<ParsedUsOpenWorkbook | null>(null)
  const [trapParsed, setTrapParsed] = useState<ParsedTrapSeriesWorkbook | null>(null)
  const [seasonName, setSeasonName] = useState("2026 Season")
  const [seasonStart, setSeasonStart] = useState("2026-01-01")
  const [seasonEnd, setSeasonEnd] = useState("2026-12-31")
  const [seasonId, setSeasonId] = useState("")
  const [makeSeasonActive, setMakeSeasonActive] = useState(true)
  const [eventName, setEventName] = useState("2026 US Open")
  const [shootDate, setShootDate] = useState("2026-01-01")
  const [locationName, setLocationName] = useState("")
  const [trapEntryFee, setTrapEntryFee] = useState("140")
  const [skeetEntryFee, setSkeetEntryFee] = useState("130")
  const [sportingEntryFee, setSportingEntryFee] = useState("130")
  const [organizationFee, setOrganizationFee] = useState("0")
  const [trapSeriesEventName, setTrapSeriesEventName] = useState("2026 Trap Series #1")
  const [trapSeriesDate, setTrapSeriesDate] = useState("2026-01-01")
  const [trapSeriesEntryFee, setTrapSeriesEntryFee] = useState("0")
  const [trapSeriesOrganizationFee, setTrapSeriesOrganizationFee] = useState("2")
  const [seasonError, setSeasonError] = useState("")
  const [closingSeason, setClosingSeason] = useState<Season | null>(null)
  const [createNextSeason, setCreateNextSeason] = useState(true)
  const [nextSeasonName, setNextSeasonName] = useState("2027 Season")
  const [nextSeasonStart, setNextSeasonStart] = useState("2027-01-01")
  const [nextSeasonEnd, setNextSeasonEnd] = useState("2027-12-31")
  const [closeoutSummary, setCloseoutSummary] = useState<SeasonCloseoutSummary | null>(null)

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

  const trapTotals = useMemo(() => {
    const rows = trapParsed?.sheets.flatMap((sheet) => sheet.rows) ?? []
    return {
      rows: rows.length,
      ready: rows.filter((row) => !row.errors.length).length,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0),
      errors: rows.reduce((sum, row) => sum + row.errors.length, 0),
    }
  }, [trapParsed])

  async function handleTrapSeriesFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const result = await parseTrapSeriesWorkbook(file)
      setTrapParsed(result)
      const rowCount = result.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)
      toast.success(`${rowCount} Trap Series entries found across ${result.sheets.length} shoot worksheets`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read Trap Series workbook")
    } finally {
      setBusy(false)
    }
  }

  async function handleTrapSeriesImport() {
    if (!trapParsed || !seasonId) return
    setBusy(true)
    try {
      const result = await importTrapSeriesWorkbook(trapParsed, {
        seasonId,
        eventName: trapSeriesEventName,
        eventDate: trapSeriesDate,
        entryFee: Number(trapSeriesEntryFee) || 0,
        organizationFee: Number(trapSeriesOrganizationFee) || 0,
      })
      toast.success(`${result.uniqueParticipants} participants and ${result.importedRows} Trap Series entries imported into ${trapSeriesEventName}`)
      setTrapParsed(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trap Series import failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateSeason() {
    setBusy(true)
    setSeasonError("")
    try {
      const id = await createSeason({ name: seasonName, startDate: seasonStart, endDate: seasonEnd, makeActive: makeSeasonActive })
      const updated = await listSeasons()
      setSeasons(updated)
      setSeasonId(id)
      toast.success(`${seasonName} created`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create season"
      setSeasonError(message)
      toast.error(message)
    } finally { setBusy(false) }
  }

  async function handleClose(season: Season) {
    setClosingSeason(season)
    setCloseoutSummary(null)
    const year = Number(season.end_date.slice(0, 4)) + 1
    setNextSeasonName(`${year} Season`)
    setNextSeasonStart(`${year}-01-01`)
    setNextSeasonEnd(`${year}-12-31`)
  }

  async function confirmCloseout() {
    if (!closingSeason) return
    setBusy(true)
    try {
      const summary = await closeSeasonAndRollover({
        seasonId: closingSeason.id,
        createNext: createNextSeason,
        nextName: nextSeasonName,
        nextStartDate: nextSeasonStart,
        nextEndDate: nextSeasonEnd,
      })
      setCloseoutSummary(summary)
      await refresh()
      if (summary.nextSeasonId) setSeasonId(summary.nextSeasonId)
      toast.success(createNextSeason ? `${closingSeason.name} closed and ${nextSeasonName} created` : `${closingSeason.name} closed`)
      setClosingSeason(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to close season")
    } finally { setBusy(false) }
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
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={makeSeasonActive} onChange={(e) => setMakeSeasonActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Make this the active season immediately
            </label>
            {seasonError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <strong>Season creation failed:</strong> {seasonError}
              </div>
            )}
            {closingSeason && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Close {closingSeason.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">Events will be archived and historical scores and financial records will remain available in reports.</p>
                  </div>
                  <RefreshCw className="h-5 w-5 text-amber-600" />
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={createNextSeason} onChange={(e) => setCreateNextSeason(e.target.checked)} />
                  Create and activate the next season
                </label>
                {createNextSeason && <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input className={input} value={nextSeasonName} onChange={(e) => setNextSeasonName(e.target.value)} />
                  <input className={input} type="date" value={nextSeasonStart} onChange={(e) => setNextSeasonStart(e.target.value)} />
                  <input className={input} type="date" value={nextSeasonEnd} onChange={(e) => setNextSeasonEnd(e.target.value)} />
                </div>}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setClosingSeason(null)} disabled={busy}>Cancel</Button>
                  <Button onClick={confirmCloseout} disabled={busy || (createNextSeason && (!nextSeasonName || !nextSeasonStart || !nextSeasonEnd))}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Close season{createNextSeason ? " and start next" : ""}
                  </Button>
                </div>
              </div>
            )}
            {closeoutSummary && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Closeout complete: {closeoutSummary.events} events, {closeoutSummary.shoots} shoots, {closeoutSummary.registrations} registrations, and {closeoutSummary.scores} score entries preserved.
              </div>
            )}
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {loading ? <p className="text-sm text-slate-500">Loading seasons…</p> : seasons.length === 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 lg:col-span-3">No seasons are available yet. Create one above. If creation fails, ClayKeeper will now show the exact Supabase error.</div> : seasons.map((season) => (
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
                <h2 className="text-lg font-semibold text-slate-900">Trap Series workbook import</h2>
                <p className="mt-1 text-sm text-slate-600">Imports every shoot-location worksheet as a separate American Trap shoot inside one series event. Teams, classes, squads, four 25-target rounds, and totals are preserved.</p>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-amber-600" />
            </div>
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-amber-500 hover:bg-amber-50/40">
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-amber-600" /> : <Upload className="h-8 w-8 text-amber-600" />}
              <span className="mt-3 font-medium text-slate-800">Choose a Trap Series workbook</span>
              <span className="mt-1 text-xs text-slate-500">Example: 2026 Trap Series 1.xlsx. QR-code and blank worksheets are ignored automatically.</span>
              <input className="hidden" type="file" accept=".xlsx,.xls" onChange={(e) => void handleTrapSeriesFile(e.target.files?.[0])} />
            </label>

            {trapParsed && <>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[['Entries', trapTotals.rows], ['Ready', trapTotals.ready], ['Warnings', trapTotals.warnings], ['Errors', trapTotals.errors]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {trapParsed.sheets.map((sheet) => <div key={sheet.sheetName} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><strong>{sheet.sheetName}</strong><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{sheet.rows.length} entries</span></div><p className="mt-2 text-xs text-slate-500">{sheet.hasSquadNumbers ? 'Squad numbers detected' : 'No squad column; imported holding squads will be created'}</p></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <select className={input} value={seasonId} onChange={(e) => setSeasonId(e.target.value)} disabled={loading}><option value="">{loading ? "Loading seasons…" : seasons.length ? "Select season" : "No seasons available"}</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select>
                <input className={input} value={trapSeriesEventName} onChange={(e) => setTrapSeriesEventName(e.target.value)} placeholder="Series event name" />
                <input className={input} type="date" value={trapSeriesDate} onChange={(e) => setTrapSeriesDate(e.target.value)} />
                <input className={input} type="number" min="0" step="0.01" value={trapSeriesEntryFee} onChange={(e) => setTrapSeriesEntryFee(e.target.value)} placeholder="Entry fee per shoot" />
                <input className={input} type="number" min="0" step="0.01" value={trapSeriesOrganizationFee} onChange={(e) => setTrapSeriesOrganizationFee(e.target.value)} placeholder="Organization/CYSSA fee" />
              </div>

              <div className="mt-5 max-h-[520px] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Shoot</th><th className="px-3 py-2">Row</th><th className="px-3 py-2">Participant</th><th className="px-3 py-2">Team</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Squad</th><th className="px-3 py-2">Rounds</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody>{trapParsed.sheets.flatMap((sheet) => sheet.rows.map((row) => <tr key={`${sheet.sheetName}-${row.rowNumber}`} className="border-t border-slate-100"><td className="px-3 py-2 font-medium">{sheet.sheetName}</td><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.firstName} {row.lastName}</td><td className="px-3 py-2">{row.team || '—'}</td><td className="px-3 py-2">{row.classCode || '—'}</td><td className="px-3 py-2">{row.squadNumber || 'Auto'}</td><td className="px-3 py-2 whitespace-nowrap">{row.scores.map((score) => score ?? '—').join(' · ')}</td><td className="px-3 py-2 font-semibold">{row.total ?? '—'}</td><td className="px-3 py-2">{row.errors.length ? <span className="inline-flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" />{row.errors[0]}</span> : row.warnings.length ? <span className="text-amber-600">{row.warnings[0]}</span> : <span className="inline-flex items-center text-emerald-600"><CheckCircle2 className="mr-1 h-4 w-4" />Ready</span>}</td></tr>))}</tbody>
                </table>
              </div>
              <div className="mt-5 flex justify-end"><Button onClick={handleTrapSeriesImport} disabled={busy || trapTotals.errors > 0 || !seasonId || !trapSeriesEventName || !trapSeriesDate}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Import complete Trap Series</Button></div>
            </>}
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
                <select className={input} value={seasonId} onChange={(e) => setSeasonId(e.target.value)} disabled={loading}><option value="">{loading ? "Loading seasons…" : seasons.length ? "Select season" : "No seasons available"}</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select>
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
