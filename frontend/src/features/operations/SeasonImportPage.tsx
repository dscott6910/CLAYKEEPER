import { useEffect, useMemo, useRef, useState } from "react"
import { Archive, Ban, CalendarPlus, CheckCircle2, FileSpreadsheet, Loader2, Pencil, RefreshCw, Trash2, Upload, UsersRound, XCircle } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { deleteHistoricalImport, finalizeHistoricalImport, ImportCancelledError, importTrapSeriesWorkbook, importUsOpenWorkbook, listHistoricalImports, parseTrapSeriesWorkbook, parseUsOpenWorkbook, type HistoricalImportRecord, type ParsedTrapSeriesWorkbook, type ParsedUsOpenWorkbook } from "@/lib/services/historicalImport"
import { ActiveNetImportCancelledError, importActiveNetWorkbook, parseActiveNetWorkbook, type ParsedActiveNetWorkbook } from "@/lib/services/activenetImport"
import { activateSeason, closeSeasonAndRollover, createSeason, listSeasons, updateSeason, type Season, type SeasonCloseoutSummary } from "@/lib/services/seasons"

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
  const [eventName, setEventName] = useState("")
  const [shootDate, setShootDate] = useState("")
  const [locationName, setLocationName] = useState("")
  const [trapEntryFee, setTrapEntryFee] = useState("140")
  const [skeetEntryFee, setSkeetEntryFee] = useState("130")
  const [sportingEntryFee, setSportingEntryFee] = useState("130")
  const [organizationFee, setOrganizationFee] = useState("0")
  const [trapSeriesEventName, setTrapSeriesEventName] = useState("")
  const [trapSeriesDate, setTrapSeriesDate] = useState("")
  const [trapSeriesEntryFee, setTrapSeriesEntryFee] = useState("0")
  const [trapSeriesOrganizationFee, setTrapSeriesOrganizationFee] = useState("2")
  const [seasonError, setSeasonError] = useState("")
  const [closingSeason, setClosingSeason] = useState<Season | null>(null)
  const [createNextSeason, setCreateNextSeason] = useState(true)
  const [nextSeasonName, setNextSeasonName] = useState("2027 Season")
  const [nextSeasonStart, setNextSeasonStart] = useState("2027-01-01")
  const [nextSeasonEnd, setNextSeasonEnd] = useState("2027-12-31")
  const [closeoutSummary, setCloseoutSummary] = useState<SeasonCloseoutSummary | null>(null)
  const [editingSeason, setEditingSeason] = useState<Season | null>(null)
  const [editSeasonName, setEditSeasonName] = useState("")
  const [editSeasonStart, setEditSeasonStart] = useState("")
  const [editSeasonEnd, setEditSeasonEnd] = useState("")
  const [importHistory, setImportHistory] = useState<HistoricalImportRecord[]>([])
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null)
  const [finalizingImportId, setFinalizingImportId] = useState<string | null>(null)
  const [deleteMessage, setDeleteMessage] = useState("")
  const [trapImportRunning, setTrapImportRunning] = useState(false)
  const [trapImportMessage, setTrapImportMessage] = useState("")
  const [trapImportProgress, setTrapImportProgress] = useState({ completedRows: 0, totalRows: 0, percent: 0, stage: "preparing" as "preparing" | "importing" | "finalizing" | "completed" })
  const [activeTrapImportId, setActiveTrapImportId] = useState<string | null>(null)
  const trapCancelRef = useRef(false)
  const [activeNetParsed, setActiveNetParsed] = useState<ParsedActiveNetWorkbook | null>(null)
  const [activeNetEventName, setActiveNetEventName] = useState("")
  const [activeNetRegistrationDate, setActiveNetRegistrationDate] = useState("")
  const [activeNetImportRunning, setActiveNetImportRunning] = useState(false)
  const [activeNetImportMessage, setActiveNetImportMessage] = useState("")
  const [activeNetProgress, setActiveNetProgress] = useState({ completedRows: 0, totalRows: 0, percent: 0, stage: "preparing" as "preparing" | "importing" | "finalizing" | "completed" })
  const activeNetCancelRef = useRef(false)

  async function refresh() {
    setLoading(true)
    try {
      const [data, imports] = await Promise.all([listSeasons(), listHistoricalImports()])
      setSeasons(data)
      setImportHistory(imports)
      setSeasonId((current) => current && data.some((season) => season.id === current) ? current : "")
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

  const trapRequiredFields = [
    { label: "Season", complete: Boolean(seasonId) },
    { label: "Series name", complete: Boolean(trapSeriesEventName.trim()) },
    { label: "Shoot date", complete: Boolean(trapSeriesDate) },
  ]
  const trapSetupComplete = trapRequiredFields.every((field) => field.complete)
  const usOpenRequiredFields = [
    { label: "Season", complete: Boolean(seasonId) },
    { label: "Event name", complete: Boolean(eventName.trim()) },
    { label: "Shoot date", complete: Boolean(shootDate) },
  ]
  const usOpenSetupComplete = usOpenRequiredFields.every((field) => field.complete)
  const activeNetTotals = useMemo(() => {
    const rows = activeNetParsed?.rows ?? []
    return {
      rows: rows.length,
      ready: rows.filter((row) => !row.errors.length && row.discipline).length,
      uniqueParticipants: new Set(rows.filter((row) => !row.errors.length).map((row) => `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}`)).size,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0),
      errors: rows.filter((row) => row.errors.length).length,
    }
  }, [activeNetParsed])
  const activeNetSetupComplete = Boolean(seasonId && activeNetEventName.trim() && activeNetRegistrationDate)

  async function handleActiveNetFile(file: File | undefined) {
    if (!file) return
    activeNetCancelRef.current = false
    setActiveNetImportMessage("")
    setActiveNetProgress({ completedRows: 0, totalRows: 0, percent: 0, stage: "preparing" })
    setBusy(true)
    try {
      const result = await parseActiveNetWorkbook(file)
      setActiveNetParsed(result)
      if (!activeNetEventName.trim()) {
        const sourceSeason = result.rows.find((row) => row.seasonName)?.seasonName
        setActiveNetEventName(sourceSeason ? `${sourceSeason} ActiveNet Registrations` : "ActiveNet Season Registrations")
      }
      toast.success(`${result.rows.length} ActiveNet rows and ${new Set(result.rows.map((row) => `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}`)).size} participants found`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read ActiveNet report")
    } finally {
      setBusy(false)
    }
  }

  async function handleActiveNetImport() {
    if (!activeNetParsed || !activeNetSetupComplete || activeNetParsed.workbookErrors.length) return
    activeNetCancelRef.current = false
    setActiveNetImportRunning(true)
    setBusy(true)
    setActiveNetImportMessage("Starting ActiveNet import…")
    setActiveNetProgress({ completedRows: 0, totalRows: activeNetTotals.ready, percent: 0, stage: "preparing" })
    try {
      const result = await importActiveNetWorkbook(activeNetParsed, {
        seasonId,
        eventName: activeNetEventName,
        registrationDate: activeNetRegistrationDate,
      }, {
        isCancelled: () => activeNetCancelRef.current,
        onProgress: (progress) => {
          setActiveNetImportMessage(progress.message)
          setActiveNetProgress(progress)
        },
      })
      toast.success(`${result.uniqueParticipants} participants and ${result.importedRows} discipline registrations imported`)
      setActiveNetImportMessage("ActiveNet import completed successfully.")
      setActiveNetProgress((current) => ({ ...current, percent: 100, stage: "completed" }))
      setActiveNetParsed(null)
      await refresh()
    } catch (error) {
      if (error instanceof ActiveNetImportCancelledError) {
        setActiveNetImportMessage("Import stopped. Use Cleanup import in Imported workbook history to remove the partial data.")
        toast.warning("ActiveNet import stopped and is ready for cleanup.")
      } else {
        const message = error instanceof Error ? error.message : "ActiveNet import failed"
        setActiveNetImportMessage(`Import failed: ${message}`)
        toast.error(message)
      }
      await refresh()
    } finally {
      setActiveNetImportRunning(false)
      setBusy(false)
    }
  }

  function handleCancelActiveNetImport() {
    activeNetCancelRef.current = true
    setActiveNetImportMessage("Stopping the ActiveNet import after the current database step…")
  }

  function handleClearActiveNetWorkbook() {
    if (activeNetImportRunning) return
    setActiveNetParsed(null)
    setActiveNetImportMessage("")
    setActiveNetProgress({ completedRows: 0, totalRows: 0, percent: 0, stage: "preparing" })
    activeNetCancelRef.current = false
  }

  async function handleTrapSeriesFile(file: File | undefined) {
    if (!file) return
    trapCancelRef.current = false
    setTrapImportMessage("")
    setTrapImportProgress({ completedRows: 0, totalRows: 0, percent: 0, stage: "preparing" })
    setActiveTrapImportId(null)
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
    if (!trapParsed || !seasonId || trapParsed.workbookErrors.length) return
    trapCancelRef.current = false
    setTrapImportRunning(true)
    setBusy(true)
    setTrapImportMessage("Starting import…")
    setTrapImportProgress({ completedRows: 0, totalRows: trapTotals.ready, percent: 0, stage: "preparing" })
    try {
      const result = await importTrapSeriesWorkbook(trapParsed, {
        seasonId,
        eventName: trapSeriesEventName,
        eventDate: trapSeriesDate,
        entryFee: Number(trapSeriesEntryFee) || 0,
        organizationFee: Number(trapSeriesOrganizationFee) || 0,
      }, {
        isCancelled: () => trapCancelRef.current,
        onImportCreated: setActiveTrapImportId,
        onProgress: (progress) => {
          setTrapImportMessage(progress.message)
          setTrapImportProgress({ completedRows: progress.completedRows, totalRows: progress.totalRows, percent: progress.percent, stage: progress.stage })
        },
      })
      toast.success(`${result.uniqueParticipants} participants and ${result.importedRows} Trap Series entries imported${result.skippedRows ? `; ${result.skippedRows} invalid row(s) skipped` : ""}`)
      setTrapImportMessage("Import completed successfully.")
      setTrapImportProgress((current) => ({ ...current, completedRows: current.totalRows, percent: 100, stage: "completed" }))
      await refresh()
      setTrapParsed(null)
      setActiveTrapImportId(null)
    } catch (error) {
      if (error instanceof ImportCancelledError) {
        setTrapImportMessage("Import stopped. Use Cleanup import in Imported workbook history to remove the partial import.")
        toast.warning("Import stopped. The partial import is ready for cleanup.")
        await refresh()
      } else {
        const message = error instanceof Error ? error.message : "Trap Series import failed"
        setTrapImportMessage(`Import failed: ${message}`)
        toast.error(message)
        await refresh()
      }
    } finally {
      setTrapImportRunning(false)
      setBusy(false)
    }
  }

  function handleCancelTrapImport() {
    trapCancelRef.current = true
    setTrapImportMessage("Stopping import after the current database step…")
    toast.info("Stopping the import safely…")
  }

  function handleClearTrapWorkbook() {
    if (trapImportRunning) return
    setTrapParsed(null)
    setTrapImportMessage("")
    setTrapImportProgress({ completedRows: 0, totalRows: 0, percent: 0, stage: "preparing" })
    setActiveTrapImportId(null)
    trapCancelRef.current = false
  }


  async function handleFinalizeImport(item: HistoricalImportRecord) {
    setFinalizingImportId(item.id)
    setDeleteMessage(`Checking ${item.file_name} and finalizing its status...`)
    try {
      const result = await finalizeHistoricalImport(item.id)
      setDeleteMessage(`Import completed with ${result.importedRows} entries.`)
      toast.success(`${item.file_name} marked complete`)
      await refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to finalize import"
      setDeleteMessage(`Finalize failed: ${message}`)
      toast.error(message, { duration: 12000 })
      window.alert(`Finish Import failed.\n\n${message}`)
    } finally {
      setFinalizingImportId(null)
    }
  }

  async function handleDeleteImport(item: HistoricalImportRecord) {
    const confirmed = window.confirm(`Delete the import from ${item.file_name}?\n\nThis permanently removes the imported event, shoots, registrations, squads, and scores. Participants, teams, classes, and locations are kept because they may be used elsewhere.`)
    if (!confirmed) return
    setDeletingImportId(item.id)
    setDeleteMessage(`Deleting ${item.file_name}...`)
    try {
      const result = await deleteHistoricalImport(item.id)
      setDeleteMessage(`Deleted ${result.eventName || item.file_name}. Refreshing import history...`)
      await refresh()
      setDeleteMessage(`Successfully deleted ${result.eventName || item.file_name}.`)
      toast.success(`Deleted ${result.eventName || item.file_name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete import"
      setDeleteMessage(`Delete failed: ${message}`)
      toast.error(message, { duration: 12000 })
      window.alert(`Delete Import failed.\n\n${message}`)
    } finally {
      setDeletingImportId(null)
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

  function beginEditSeason(season: Season) {
    setEditingSeason(season)
    setEditSeasonName(season.name)
    setEditSeasonStart(season.start_date)
    setEditSeasonEnd(season.end_date)
    setSeasonError("")
  }

  async function saveSeasonChanges() {
    if (!editingSeason) return
    setBusy(true)
    setSeasonError("")
    try {
      const updated = await updateSeason({
        id: editingSeason.id,
        name: editSeasonName,
        startDate: editSeasonStart,
        endDate: editSeasonEnd,
      })
      setSeasons((current) => current.map((season) => season.id === updated.id ? updated : season))
      setEditingSeason(null)
      toast.success(`${updated.name} updated`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update season"
      setSeasonError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
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
      <AppHeader title="Seasons & Historical Import" description="Manage seasons and import Trap Series results and historical competition workbooks. ActiveNet participant files have their own dedicated import page." />
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
            {editingSeason && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Edit season</h3>
                    <p className="mt-1 text-sm text-slate-600">Update the season name and date range. Events, scores, and reports linked to this season are preserved.</p>
                  </div>
                  <Pencil className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="text-sm font-medium text-slate-700">Season name<span className="text-red-600"> *</span><input className={`${input} mt-1`} value={editSeasonName} onChange={(e) => setEditSeasonName(e.target.value)} /></label>
                  <label className="text-sm font-medium text-slate-700">Start date<span className="text-red-600"> *</span><input className={`${input} mt-1`} type="date" value={editSeasonStart} onChange={(e) => setEditSeasonStart(e.target.value)} /></label>
                  <label className="text-sm font-medium text-slate-700">End date<span className="text-red-600"> *</span><input className={`${input} mt-1`} type="date" min={editSeasonStart || undefined} value={editSeasonEnd} onChange={(e) => setEditSeasonEnd(e.target.value)} /></label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingSeason(null)} disabled={busy}>Cancel</Button>
                  <Button onClick={saveSeasonChanges} disabled={busy || !editSeasonName.trim() || !editSeasonStart || !editSeasonEnd || editSeasonEnd < editSeasonStart}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
                  </Button>
                </div>
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
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => beginEditSeason(season)} disabled={busy}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
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
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Season <span className="text-red-600">*</span><select className={`${input} mt-1 ${!seasonId ? "border-red-300" : ""}`} value={seasonId} onChange={(e) => setSeasonId(e.target.value)} disabled={loading || trapImportRunning}><option value="">{loading ? "Loading seasons…" : seasons.length ? "Choose a season" : "No seasons available"}</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Series name <span className="text-red-600">*</span><input className={`${input} mt-1 ${!trapSeriesEventName.trim() ? "border-red-300" : ""}`} value={trapSeriesEventName} onChange={(e) => setTrapSeriesEventName(e.target.value)} placeholder="Example: 2026 Trap Series Shoot 1" disabled={trapImportRunning} /></label>
                <label className="text-sm font-medium text-slate-700">Shoot date <span className="text-red-600">*</span><input className={`${input} mt-1 ${!trapSeriesDate ? "border-red-300" : ""}`} type="date" value={trapSeriesDate} onChange={(e) => setTrapSeriesDate(e.target.value)} disabled={trapImportRunning} /></label>
              </div>
              {!trapSetupComplete && <p className="mt-3 text-sm font-medium text-red-700">Choose a season, enter a series name, and select a date before choosing a workbook.</p>}
            </div>
            <label className={`mt-5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center ${trapSetupComplete && !trapImportRunning ? "cursor-pointer border-slate-300 hover:border-amber-500 hover:bg-amber-50/40" : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"}`}>
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-amber-600" /> : <Upload className="h-8 w-8 text-amber-600" />}
              <span className="mt-3 font-medium text-slate-800">Choose a Trap Series workbook</span>
              <span className="mt-1 text-xs text-slate-500">Example: 2026 Trap Series 1.xlsx. QR-code and blank worksheets are ignored automatically.</span>
              <input className="hidden" type="file" accept=".xlsx,.xls" disabled={!trapSetupComplete || trapImportRunning} onChange={(e) => void handleTrapSeriesFile(e.target.files?.[0])} />
            </label>

            {trapParsed && <>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[['Entries', trapTotals.rows], ['Ready', trapTotals.ready], ['Warnings', trapTotals.warnings], ['Errors', trapTotals.errors]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {trapParsed.sheets.map((sheet) => <div key={sheet.sheetName} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><strong>{sheet.sheetName}</strong><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{sheet.rows.length} entries</span></div><p className="mt-2 text-xs text-slate-500">{sheet.hasSquadNumbers ? 'Squad numbers detected' : 'No squad column; imported holding squads will be created'}</p></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input className={input} type="number" min="0" step="0.01" value={trapSeriesEntryFee} onChange={(e) => setTrapSeriesEntryFee(e.target.value)} placeholder="Entry fee per shoot" />
                <input className={input} type="number" min="0" step="0.01" value={trapSeriesOrganizationFee} onChange={(e) => setTrapSeriesOrganizationFee(e.target.value)} placeholder="Organization/CYSSA fee" />
              </div>

              {trapParsed.workbookErrors.length > 0 && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"><strong>Workbook structure errors must be corrected before importing.</strong><ul className="mt-2 list-disc space-y-1 pl-5">{trapParsed.workbookErrors.map((error) => <li key={error}>{error}</li>)}</ul><p className="mt-3">No data will be imported from this workbook. Correct the spreadsheet, press Remove faulty spreadsheet, and select the corrected file.</p></div>}

              {trapTotals.errors > 0 && trapParsed.workbookErrors.length === 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>{trapTotals.errors} invalid row(s) will be skipped.</strong> The remaining {trapTotals.ready} valid entries can still be imported. Review the red rows below for details.</div>}

              {trapImportMessage && <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${trapImportMessage.startsWith("Import failed") ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}><div className="flex items-center gap-2">{trapImportRunning && <Loader2 className="h-4 w-4 animate-spin" />}<span>{trapImportMessage}</span></div>{activeTrapImportId && trapImportRunning ? <div className="mt-1 text-xs opacity-75">A cleanup record has been created and can be deleted if the import is stopped.</div> : null}</div>}

              <div className="mt-5 max-h-[520px] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Shoot</th><th className="px-3 py-2">Row</th><th className="px-3 py-2">Participant</th><th className="px-3 py-2">Team</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Squad</th><th className="px-3 py-2">Rounds</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody>{trapParsed.sheets.flatMap((sheet) => sheet.rows.map((row) => <tr key={`${sheet.sheetName}-${row.rowNumber}`} className="border-t border-slate-100"><td className="px-3 py-2 font-medium">{sheet.sheetName}</td><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.firstName} {row.lastName}</td><td className="px-3 py-2">{row.team || '—'}</td><td className="px-3 py-2">{row.classCode || '—'}</td><td className="px-3 py-2">{row.squadNumber || 'Auto'}</td><td className="px-3 py-2 whitespace-nowrap">{row.scores.map((score) => score ?? '—').join(' · ')}</td><td className="px-3 py-2 font-semibold">{row.total ?? '—'}</td><td className="px-3 py-2">{row.errors.length ? <span className="inline-flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" />{row.errors[0]}</span> : row.warnings.length ? <span className="text-amber-600">{row.warnings[0]}</span> : <span className="inline-flex items-center text-emerald-600"><CheckCircle2 className="mr-1 h-4 w-4" />Ready</span>}</td></tr>))}</tbody>
                </table>
              </div>
              {(trapImportRunning || trapImportMessage) && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">{trapImportMessage || "Preparing import…"}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {trapImportProgress.totalRows > 0
                          ? `${trapImportProgress.completedRows} of ${trapImportProgress.totalRows} entries processed`
                          : "Preparing workbook and database records"}
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-amber-700">{trapImportProgress.percent}%</div>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={trapImportProgress.percent}>
                    <div className="h-full rounded-full bg-amber-600 transition-[width] duration-300" style={{ width: `${trapImportProgress.percent}%` }} />
                  </div>
                  {activeTrapImportId ? <div className="mt-2 text-xs text-slate-500">Import recovery ID: {activeTrapImportId.slice(0, 8)}</div> : null}
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={handleClearTrapWorkbook} disabled={trapImportRunning}>{trapParsed.workbookErrors.length ? <XCircle className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}{trapParsed.workbookErrors.length ? "Remove faulty spreadsheet" : "Clear spreadsheet"}</Button>
                {trapImportRunning ? <Button variant="destructive" onClick={handleCancelTrapImport} disabled={trapCancelRef.current}><Ban className="mr-2 h-4 w-4" />{trapCancelRef.current ? "Stopping…" : "Kill / Stop import"}</Button> : <Button onClick={handleTrapSeriesImport} disabled={busy || trapParsed.workbookErrors.length > 0 || trapTotals.ready === 0 || !trapSetupComplete}><Upload className="mr-2 h-4 w-4" />Import complete Trap Series</Button>}
              </div>
            </>}
          </section>

          {activeNetParsed && false && (<>
          <section className={card}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">ActiveNet registration import</h2>
                <p className="mt-1 text-sm text-slate-600">Permanent importer for ActiveNet Excel or CSV reports. Participants are matched by name, new athletes are created when needed, and each ActiveNet session becomes a Trap, Skeet, Sporting Clays, or Bunker enrollment.</p>
              </div>
              <UsersRound className="h-6 w-6 text-orange-600" />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">ClayKeeper season <span className="text-red-600">*</span><select className={`${input} mt-1 ${!seasonId ? "border-red-300" : ""}`} value={seasonId} onChange={(e) => setSeasonId(e.target.value)} disabled={loading || busy}><option value="">{loading ? "Loading seasons…" : "Choose a season"}</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Registration event name <span className="text-red-600">*</span><input className={`${input} mt-1 ${!activeNetEventName.trim() ? "border-red-300" : ""}`} value={activeNetEventName} onChange={(e) => setActiveNetEventName(e.target.value)} placeholder="2025-2026 ActiveNet Registrations" disabled={busy} /></label>
                <label className="text-sm font-medium text-slate-700">Import/registration date <span className="text-red-600">*</span><input className={`${input} mt-1 ${!activeNetRegistrationDate ? "border-red-300" : ""}`} type="date" value={activeNetRegistrationDate} onChange={(e) => setActiveNetRegistrationDate(e.target.value)} disabled={busy} /></label>
              </div>
              {!activeNetSetupComplete && <p className="mt-3 text-sm font-medium text-red-700">Choose a season, enter a registration event name, and select a date before choosing an ActiveNet report.</p>}
            </div>

            <label className={`mt-5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center ${activeNetSetupComplete && !busy ? "cursor-pointer border-slate-300 hover:border-orange-500 hover:bg-orange-50/40" : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"}`}>
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-orange-600" /> : <Upload className="h-8 w-8 text-orange-600" />}
              <span className="mt-3 font-medium text-slate-800">Choose an ActiveNet Excel or CSV report</span>
              <span className="mt-1 text-xs text-slate-500">Recognizes Participant Name, Gender, Primary P/G, Season, Session, Age, and Balance columns.</span>
              <input className="hidden" type="file" accept=".xlsx,.xls,.csv" disabled={!activeNetSetupComplete || busy} onChange={(e) => void handleActiveNetFile(e.target.files?.[0])} />
            </label>

            {activeNetParsed && <>
              {activeNetParsed!.workbookErrors.length > 0 && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"><strong>Required ActiveNet columns are missing.</strong><ul className="mt-2 list-disc pl-5">{activeNetParsed!.workbookErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
              <div className="mt-5 grid gap-3 sm:grid-cols-5">
                {[['Rows', activeNetTotals.rows], ['Participants', activeNetTotals.uniqueParticipants], ['Ready', activeNetTotals.ready], ['Warnings', activeNetTotals.warnings], ['Errors', activeNetTotals.errors]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}
              </div>

              {(activeNetImportRunning || activeNetImportMessage) && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between gap-4 text-sm"><strong className="text-blue-900">{activeNetImportMessage || "Preparing ActiveNet import…"}</strong><span className="font-semibold text-blue-800">{activeNetProgress.percent}%</span></div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${activeNetProgress.percent}%` }} /></div>
                <p className="mt-2 text-xs text-blue-700">{activeNetProgress.completedRows} of {activeNetProgress.totalRows} valid discipline registrations processed</p>
              </div>}

              <div className="mt-5 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Participant</th><th className="px-3 py-2">Guardian</th><th className="px-3 py-2">Session</th><th className="px-3 py-2">Age</th><th className="px-3 py-2">Balance</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody>{activeNetParsed!.rows.slice(0, 300).map((row) => <tr key={row.rowNumber} className="border-t border-slate-100"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.participantName}</td><td className="px-3 py-2">{row.guardianName || '—'}</td><td className="px-3 py-2">{row.sessionName || '—'}</td><td className="px-3 py-2">{row.age ?? '—'}</td><td className="px-3 py-2">{row.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td><td className="px-3 py-2">{row.errors.length ? <span className="inline-flex items-center text-red-600"><XCircle className="mr-1 h-4 w-4" />{row.errors[0]}</span> : row.warnings.length ? <span className="text-amber-700">{row.warnings[0]}</span> : <span className="inline-flex items-center text-emerald-600"><CheckCircle2 className="mr-1 h-4 w-4" />Ready</span>}</td></tr>)}</tbody>
                </table>
              </div>
              {activeNetParsed!.rows.length > 300 && <p className="mt-2 text-xs text-slate-500">Preview shows the first 300 rows. All {activeNetParsed!.rows.length} rows will be processed.</p>}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={handleClearActiveNetWorkbook} disabled={activeNetImportRunning}><Trash2 className="mr-2 h-4 w-4" />Clear report</Button>
                {activeNetImportRunning ? <Button variant="destructive" onClick={handleCancelActiveNetImport} disabled={activeNetCancelRef.current}><Ban className="mr-2 h-4 w-4" />{activeNetCancelRef.current ? "Stopping…" : "Kill / Stop import"}</Button> : <Button onClick={handleActiveNetImport} disabled={busy || activeNetParsed!.workbookErrors.length > 0 || activeNetTotals.ready === 0 || !activeNetSetupComplete}><Upload className="mr-2 h-4 w-4" />Import ActiveNet registrations</Button>}
              </div>
            </>}
          </section>

          </>)}

          <section className={card}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Imported workbook history</h2>
                <p className="mt-1 text-sm text-slate-600">Delete a completed import and all event data created by it. Shared participants, teams, classes, and locations are preserved.</p>
              </div>
              <Archive className="h-6 w-6 text-slate-500" />
            </div>
            {deleteMessage ? <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${deleteMessage.startsWith("Delete failed") ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{deleteMessage}</div> : null}
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              {importHistory.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">No workbook imports have been recorded yet.</div> : <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">File</th><th className="px-3 py-2">Imported</th><th className="px-3 py-2">Rows</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
                <tbody>{importHistory.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-3"><div className="font-medium text-slate-900">{item.file_name}</div><div className="max-w-xl truncate text-xs text-slate-500">{item.worksheet_name || "—"}</div></td><td className="px-3 py-3 whitespace-nowrap">{new Date(item.created_at).toLocaleString()}</td><td className="px-3 py-3"><div>{item.imported_row_count}/{item.row_count}{item.error_count ? <span className="ml-2 text-amber-700">({item.error_count} skipped)</span> : null}</div>{item.status === "importing" ? <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-amber-500" style={{ width: `${item.row_count > 0 ? Math.min(100, Math.round((item.imported_row_count / item.row_count) * 100)) : 0}%` }} /></div> : null}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium capitalize">{item.status.replaceAll("_", " ")}</span></td><td className="px-3 py-3 text-right"><div className="flex justify-end gap-2">{item.status === "importing" ? <Button variant="outline" onClick={() => void handleFinalizeImport(item)} disabled={finalizingImportId === item.id || deletingImportId === item.id}>{finalizingImportId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Finish import</Button> : null}<Button variant="outline" onClick={() => void handleDeleteImport(item)} disabled={deletingImportId === item.id || finalizingImportId === item.id || item.status === "reversed"} className="text-red-600 hover:text-red-700">{deletingImportId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}{["failed", "cancelled", "importing"].includes(item.status) ? "Cleanup import" : "Delete import"}</Button></div></td></tr>)}</tbody>
              </table>}
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
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Season <span className="text-red-600">*</span><select className={`${input} mt-1 ${!seasonId ? "border-red-300" : ""}`} value={seasonId} onChange={(e) => setSeasonId(e.target.value)} disabled={loading || busy}><option value="">{loading ? "Loading seasons…" : seasons.length ? "Choose a season" : "No seasons available"}</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Event name <span className="text-red-600">*</span><input className={`${input} mt-1 ${!eventName.trim() ? "border-red-300" : ""}`} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Example: 2026 US Open" disabled={busy} /></label>
                <label className="text-sm font-medium text-slate-700">Shoot date <span className="text-red-600">*</span><input className={`${input} mt-1 ${!shootDate ? "border-red-300" : ""}`} type="date" value={shootDate} onChange={(e) => setShootDate(e.target.value)} disabled={busy} /></label>
              </div>
              {!usOpenSetupComplete && <p className="mt-3 text-sm font-medium text-red-700">Choose a season, enter an event name, and select a date before choosing a workbook.</p>}
            </div>

            <label className={`mt-5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center ${usOpenSetupComplete && !busy ? "cursor-pointer border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40" : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"}`}>
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-emerald-600" /> : <Upload className="h-8 w-8 text-emerald-600" />}
              <span className="mt-3 font-medium text-slate-800">Choose REVISED US OPEN 2026 SCORES.xlsx</span>
              <span className="mt-1 text-xs text-slate-500">ClayKeeper reads all three discipline worksheets and ignores the formatted blank rows.</span>
              <input className="hidden" type="file" accept=".xlsx,.xls" disabled={!usOpenSetupComplete || busy} onChange={(e) => void handleFile(e.target.files?.[0])} />
            </label>

            {parsed && <>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[['Entries', totals.rows], ['Ready', totals.ready], ['Warnings', totals.warnings], ['Errors', totals.errors]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {parsed.sheets.map((sheet) => <div key={sheet.sheetName} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><strong>{sheet.sheetName}</strong><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{sheet.rows.length} entries</span></div><p className="mt-2 text-xs text-slate-500">{sheet.roundLabels.length ? `${sheet.roundLabels.length} score rounds detected` : 'Total-score import'}</p></div>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
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
              <div className="mt-5 flex justify-end"><Button onClick={handleImport} disabled={busy || totals.errors > 0 || !usOpenSetupComplete}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Import complete US Open</Button></div>
            </>}
          </section>
        </div>
      </PageContainer>
    </div>
  )
}
