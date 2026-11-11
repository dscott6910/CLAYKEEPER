import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, FileSpreadsheet, History, Link2, Loader2, RotateCcw, Search, SkipForward, Trash2, UserPlus, Upload } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  buildActiveNetReview,
  commitActiveNetImport,
  deleteActiveNetImport,
  getActiveNetImportHistory,
  parseActiveNetWorkbook,
  type ActiveNetImportHistoryRow,
  type ActiveNetReviewRow,
} from "@/lib/services/activeNetRegistry"
import type { ParticipantRecord } from "@/lib/services/participants"

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
const participantName = (participant?: ParticipantRecord) => participant ? `${participant.first_name} ${participant.last_name}`.trim() : "Participant unavailable"

function missingFieldsForMatch(row: ActiveNetReviewRow, participant?: ParticipantRecord) {
  if (!participant) return []
  const fields: string[] = []
  if (!participant.external_id && row.participantExternalId) fields.push("ActiveNet ID")
  if (!participant.gender && row.gender) fields.push("gender")
  if (!participant.email && row.email) fields.push("email")
  if (!participant.phone && row.phone) fields.push("phone")
  if (!participant.emergency_contact_name && row.guardianName) fields.push("emergency contact")
  if (!participant.emergency_contact_phone && row.emergencyContactPhone) fields.push("emergency phone")
  if (!participant.team_id && row.teamName) fields.push("team, if already in ClayKeeper")
  return fields
}

type ParticipantReviewRow = ActiveNetReviewRow & {
  registrationCount: number
  sessionSummary: string
}

export function ActiveNetImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ActiveNetReviewRow[]>([])
  const [participants, setParticipants] = useState<ParticipantRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [progress, setProgress] = useState({ completed: 0, total: 0, message: "" })
  const [completedSummary, setCompletedSummary] = useState<{
    fileName: string
    imported: number
    participants: number
    created: number
    updated: number
    matched: number
  } | null>(null)
  const [history, setHistory] = useState<ActiveNetImportHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const participantMap = useMemo(() => Object.fromEntries(participants.map((item) => [item.id, item])), [participants])
  const reviewRows = useMemo(() => {
    const grouped = new Map<string, ParticipantReviewRow>()
    for (const row of rows) {
      const current = grouped.get(row.personKey)
      if (current) {
        current.registrationCount += 1
        current.sessionSummary = Array.from(new Set([...current.sessionSummary.split(", "), row.sessionName])).filter(Boolean).join(", ")
      } else {
        grouped.set(row.personKey, { ...row, registrationCount: 1, sessionSummary: row.sessionName })
      }
    }
    return Array.from(grouped.values())
  }, [rows])
  const filtered = useMemo(() => reviewRows.filter((row) => [
    row.participantName,
    row.participantExternalId,
    row.guardianName,
    row.teamName,
    row.email,
    row.phone,
    row.seasonName,
    row.sessionSummary,
  ].join(" ").toLowerCase().includes(search.toLowerCase())), [reviewRows, search])
  const totals = useMemo(() => ({
    exact: reviewRows.filter((row) => row.status === "exact").length,
    possible: reviewRows.filter((row) => row.status === "possible").length,
    newRows: reviewRows.filter((row) => row.status === "new").length,
    skipped: reviewRows.filter((row) => row.status === "skip").length,
  }), [reviewRows])
  const unresolvedCount = reviewRows.filter((row) => row.status === "possible" && !row.matchedParticipantId).length
  const importableCount = rows.filter((row) => row.status !== "skip").length
  const importableParticipantCount = reviewRows.filter((row) => row.status !== "skip").length
  const progressPercent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0

  async function refreshHistory() {
    setHistoryLoading(true)
    try {
      setHistory(await getActiveNetImportHistory())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load ActiveNet import history.")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => { void refreshHistory() }, [])

  function resetFile() {
    setFileName("")
    setRows([])
    setParticipants([])
    setSearch("")
    setErrorMessage("")
    setProgress({ completed: 0, total: 0, message: "" })
    setCompletedSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function chooseFile(file?: File) {
    if (!file) return
    setBusy(true)
    setErrorMessage("")
    setCompletedSummary(null)
    setProgress({ completed: 0, total: 0, message: "Reading ActiveNet file…" })
    try {
      const parsed = await parseActiveNetWorkbook(file)
      const review = await buildActiveNetReview(parsed)
      setFileName(file.name)
      setRows(review.rows)
      setParticipants(review.participants)
      const participantCount = new Set(review.rows.map((row) => row.personKey)).size
      toast.success(`${review.rows.length} registrations for ${participantCount} ActiveNet participants are ready for comparison.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read the ActiveNet report."
      setErrorMessage(message)
      toast.error(message)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } finally {
      setBusy(false)
    }
  }

  function updatePerson(personKey: string, patch: Partial<ActiveNetReviewRow>) {
    setRows((current) => current.map((row) => row.personKey === personKey ? { ...row, ...patch } : row))
  }

  async function importRows() {
    setErrorMessage("")
    if (!fileName || !rows.length) {
      setErrorMessage("Choose and review an ActiveNet file before importing.")
      return
    }
    if (unresolvedCount) {
      const message = `Resolve or skip ${unresolvedCount} possible match${unresolvedCount === 1 ? "" : "es"} before importing.`
      setErrorMessage(message)
      toast.error(message)
      return
    }
    if (!importableCount) {
      setErrorMessage("All rows are skipped. Restore at least one participant before importing.")
      return
    }

    setBusy(true)
    setProgress({ completed: 0, total: importableCount, message: "Starting ActiveNet import…" })
    try {
      const importedFileName = fileName
      const result = await commitActiveNetImport(importedFileName, rows, setProgress)
      setCompletedSummary({ fileName: importedFileName, ...result })
      toast.success(`${result.participants} ActiveNet participants compared and ${result.imported} registration records saved. No shoots or score events were created.`)
      setRows([])
      setParticipants([])
      setFileName("")
      if (fileInputRef.current) fileInputRef.current.value = ""
      await refreshHistory()
    } catch (error) {
      const message = error instanceof Error ? error.message : "ActiveNet import failed."
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  async function removeImport(importId: string, historyFileName: string) {
    if (!window.confirm(`Delete the ActiveNet import “${historyFileName}”? This removes its ActiveNet registration records but leaves participants in the Participant Directory.`)) return
    setBusy(true)
    setErrorMessage("")
    try {
      await deleteActiveNetImport(importId)
      toast.success("ActiveNet import deleted. You can now upload a corrected version.")
      await refreshHistory()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete the ActiveNet import."
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return <>
    <AppHeader title="ActiveNet Participant Import" description="Compare every ActiveNet participant with the full ClayKeeper directory, create missing participants, and fill only profile fields that are currently blank." />
    <PageContainer>
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold">Select an ActiveNet report</h2><p className="mt-1 text-sm text-slate-600">Supports the CYSSA registration export with separate participant names, ActiveNet ID, team, contact details, guardians, sessions, and balance.</p></div>
          <div className="flex flex-wrap gap-2">
            <label className={busy ? "pointer-events-none opacity-50" : "cursor-pointer"}><input ref={fileInputRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0])} /><span className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><Upload className="mr-2 h-4 w-4" />{fileName ? "Choose different file" : "Choose ActiveNet file"}</span></label>
            {fileName && <Button type="button" variant="outline" disabled={busy} onClick={resetFile}><Trash2 className="mr-2 h-4 w-4" />Remove file</Button>}
          </div>
        </div>
        {fileName && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4" />{fileName}</div>}
        {errorMessage && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{errorMessage}</div>}
        {busy && progress.message && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-center justify-between gap-3 text-sm"><span><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{progress.message}</span><span>{progressPercent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} /></div></div>}
        {completedSummary && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><span><CheckCircle2 className="mr-2 inline h-4 w-4" /><strong>{completedSummary.participants}</strong> participants compared from {completedSummary.fileName}: {completedSummary.created} created, {completedSummary.updated} updated with missing profile information, {completedSummary.matched} matched, and {completedSummary.imported} registration records preserved.</span><Button type="button" variant="outline" onClick={resetFile}><RotateCcw className="mr-2 h-4 w-4" />Import another file</Button></div>}
      </section>

      {rows.length > 0 && <>
        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          ClayKeeper preserves every nonblank source field from the report. For matched participants, it fills only blank ActiveNet ID, gender, email, phone, emergency contact, emergency phone, and an exact existing team match. Existing ClayKeeper values are never replaced.
        </section>
        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          {[["Exact matches", totals.exact], ["Review matches", totals.possible], ["New participants", totals.newRows], ["Skipped", totals.skipped]].map(([label, value]) => <div className={card} key={String(label)}><div className="text-xs uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}
        </section>
        <section className={`${card} mt-6`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="relative min-w-72 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search participant, ActiveNet ID, team, contact, or session" /></div><Button onClick={() => void importRows()} disabled={busy || unresolvedCount > 0 || importableCount === 0} title={unresolvedCount ? "Resolve or skip all possible matches first" : undefined}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Import {importableCount} registrations for {importableParticipantCount} participant{importableParticipantCount === 1 ? "" : "s"}</Button></div>
          {unresolvedCount > 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Choose a ClayKeeper participant or skip each of the {unresolvedCount} possible matches. The Import button will activate when review is complete.</div>}
          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-[1500px] w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Participant</th><th className="px-3 py-2">ActiveNet ID</th><th className="px-3 py-2">Team</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Guardian</th><th className="px-3 py-2">Sessions</th><th className="px-3 py-2">Age</th><th className="px-3 py-2">ClayKeeper match</th><th className="px-3 py-2">Missing data to add</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody>{filtered.map((row) => <tr key={row.personKey} className="border-t border-slate-100 align-top"><td className="px-3 py-3 font-medium">{row.participantName}<div className="mt-1 text-xs font-normal text-slate-500">{row.gender || "Gender not supplied"}</div></td><td className="px-3 py-3 font-mono text-xs">{row.participantExternalId || "—"}</td><td className="px-3 py-3">{row.teamName || "—"}</td><td className="px-3 py-3"><div>{row.email || "—"}</div><div className="mt-1 text-xs text-slate-500">{row.phone || ""}</div></td><td className="px-3 py-3">{row.guardianName || "—"}</td><td className="px-3 py-3">{row.sessionSummary || "—"}<div className="mt-1 text-xs text-slate-500">{row.registrationCount} registration{row.registrationCount === 1 ? "" : "s"}</div></td><td className="px-3 py-3">{row.age ?? "—"}</td><td className="px-3 py-3">{row.status === "exact" && row.matchedParticipantId ? <span className="text-emerald-700"><Link2 className="mr-1 inline h-4 w-4" />{participantName(participantMap[row.matchedParticipantId])}<span className="mt-1 block text-xs text-slate-500">{row.matchReason}</span></span> : row.status !== "skip" && row.possibleParticipantIds.length ? <select className={selectClass} value={row.status === "new" ? "__new__" : row.matchedParticipantId ?? ""} onChange={(event) => event.target.value === "__new__" ? updatePerson(row.personKey, { status: "new", matchedParticipantId: null, matchReason: "create new participant", missingFields: [] }) : updatePerson(row.personKey, { status: "possible", matchedParticipantId: event.target.value || null, matchReason: event.target.value ? "reviewed match" : "similar participant details", missingFields: missingFieldsForMatch(row, participantMap[event.target.value]) })}><option value="">Choose a possible match</option>{row.possibleParticipantIds.map((id) => <option key={id} value={id}>{participantName(participantMap[id])}</option>)}<option value="__new__">Create a new participant</option></select> : row.status === "new" ? <span className="text-blue-700"><UserPlus className="mr-1 inline h-4 w-4" />Create new participant</span> : <span className="text-slate-500">Skipped</span>}</td><td className="px-3 py-3">{row.status === "new" ? "All available profile fields" : row.status === "possible" && !row.matchedParticipantId ? "Choose a participant to compare" : row.missingFields.length ? row.missingFields.join(", ") : "No blank profile fields"}</td><td className="px-3 py-3"><Button size="sm" variant="outline" onClick={() => updatePerson(row.personKey, { status: row.status === "skip" ? (row.matchedParticipantId ? (row.possibleParticipantIds.includes(row.matchedParticipantId) ? "possible" : "exact") : row.possibleParticipantIds.length ? "possible" : "new") : "skip" })}><SkipForward className="mr-1 h-3.5 w-3.5" />{row.status === "skip" ? "Restore" : "Skip"}</Button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </>}

      <section className={`${card} mt-6`}>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold"><History className="mr-2 inline h-5 w-5" />ActiveNet Import History</h2><p className="mt-1 text-sm text-slate-600">Delete an import to remove its ActiveNet registration records, then upload a corrected file. Participant Directory records are retained.</p></div><Button type="button" variant="outline" disabled={historyLoading || busy} onClick={() => void refreshHistory()}><RotateCcw className="mr-2 h-4 w-4" />Refresh</Button></div>
        {historyLoading ? <div className="py-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading import history…</div> : history.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No ActiveNet imports have been saved yet.</div> : <div className="overflow-auto rounded-xl border border-slate-200"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Imported</th><th className="px-3 py-2">File</th><th className="px-3 py-2">Registrations</th><th className="px-3 py-2">Participants</th><th className="px-3 py-2">Matched</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2">New</th><th className="px-3 py-2">Skipped</th><th className="px-3 py-2 text-right">Action</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-3">{new Date(item.created_at).toLocaleString()}</td><td className="px-3 py-3 font-medium">{item.file_name}</td><td className="px-3 py-3">{item.row_count}</td><td className="px-3 py-3">{item.participant_count}</td><td className="px-3 py-3">{item.matched_count}</td><td className="px-3 py-3">{item.updated_count}</td><td className="px-3 py-3">{item.new_count}</td><td className="px-3 py-3">{item.skipped_count}</td><td className="px-3 py-3 text-right"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void removeImport(item.id, item.file_name)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete import</Button></td></tr>)}</tbody></table></div>}
      </section>
    </PageContainer>
  </>
}
