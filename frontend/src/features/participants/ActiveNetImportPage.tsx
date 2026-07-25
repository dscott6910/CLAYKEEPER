import { useMemo, useState } from "react"
import { CheckCircle2, FileSpreadsheet, Link2, Loader2, Search, SkipForward, UserPlus, Upload } from "lucide-react"
import { toast } from "sonner"

import { AppHeader } from "@/app/AppHeader"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { buildActiveNetReview, commitActiveNetImport, parseActiveNetWorkbook, type ActiveNetReviewRow } from "@/lib/services/activeNetRegistry"
import type { ParticipantRecord } from "@/lib/services/participants"

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
const participantName = (participant: ParticipantRecord) => `${participant.first_name} ${participant.last_name}`.trim()

export function ActiveNetImportPage() {
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ActiveNetReviewRow[]>([])
  const [participants, setParticipants] = useState<ParticipantRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")

  const participantMap = useMemo(() => Object.fromEntries(participants.map((item) => [item.id, item])), [participants])
  const filtered = useMemo(() => rows.filter((row) => [row.participantName, row.guardianName, row.seasonName, row.sessionName].join(" ").toLowerCase().includes(search.toLowerCase())), [rows, search])
  const totals = useMemo(() => ({
    exact: rows.filter((row) => row.status === "exact").length,
    possible: rows.filter((row) => row.status === "possible").length,
    newRows: rows.filter((row) => row.status === "new").length,
    skipped: rows.filter((row) => row.status === "skip").length,
  }), [rows])

  async function chooseFile(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const parsed = await parseActiveNetWorkbook(file)
      const review = await buildActiveNetReview(parsed)
      setFileName(file.name)
      setRows(review.rows)
      setParticipants(review.participants)
      toast.success(`${review.rows.length} ActiveNet registration records are ready for comparison.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read the ActiveNet report.")
    } finally {
      setBusy(false)
    }
  }

  function updateRow(key: string, patch: Partial<ActiveNetReviewRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row))
  }

  async function importRows() {
    const unresolved = rows.filter((row) => row.status === "possible" && !row.matchedParticipantId)
    if (unresolved.length) {
      toast.error(`Resolve or skip ${unresolved.length} possible match${unresolved.length === 1 ? "" : "es"} before importing.`)
      return
    }
    setBusy(true)
    try {
      const result = await commitActiveNetImport(fileName, rows)
      toast.success(`${result.imported} ActiveNet participant records imported. No shoots or score events were created.`)
      setRows([])
      setFileName("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ActiveNet import failed.")
    } finally {
      setBusy(false)
    }
  }

  return <>
    <AppHeader title="ActiveNet Participant Import" description="Import ActiveNet registration data in its own workspace and compare it with participants already in ClayKeeper. This import never creates shoots, scores, squads, or competition events." />
    <PageContainer>
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold">Select an ActiveNet report</h2><p className="mt-1 text-sm text-slate-600">Expected fields: participant name, gender, guardian name, season name, session name, and age.</p></div>
          <label className="cursor-pointer"><input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void chooseFile(event.target.files?.[0])} /><span className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><Upload className="mr-2 h-4 w-4" />Choose ActiveNet file</span></label>
        </div>
        {fileName && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4" />{fileName}</div>}
      </section>

      {rows.length > 0 && <>
        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          {[["Exact matches", totals.exact], ["Review matches", totals.possible], ["New participants", totals.newRows], ["Skipped", totals.skipped]].map(([label, value]) => <div className={card} key={String(label)}><div className="text-xs uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}
        </section>
        <section className={`${card} mt-6`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="relative min-w-72 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search participant, guardian, season, or session" /></div><Button onClick={() => void importRows()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Import reviewed participants</Button></div>
          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-[1100px] w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Participant</th><th className="px-3 py-2">Gender</th><th className="px-3 py-2">Guardian</th><th className="px-3 py-2">Season</th><th className="px-3 py-2">Session</th><th className="px-3 py-2">Age</th><th className="px-3 py-2">ClayKeeper match</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody>{filtered.map((row) => <tr key={row.key} className="border-t border-slate-100 align-top"><td className="px-3 py-3 font-medium">{row.participantName}</td><td className="px-3 py-3">{row.gender || "—"}</td><td className="px-3 py-3">{row.guardianName || "—"}</td><td className="px-3 py-3">{row.seasonName || "—"}</td><td className="px-3 py-3">{row.sessionName || "—"}</td><td className="px-3 py-3">{row.age ?? "—"}</td><td className="px-3 py-3">{row.status === "exact" && row.matchedParticipantId ? <span className="text-emerald-700"><Link2 className="mr-1 inline h-4 w-4" />{participantName(participantMap[row.matchedParticipantId])}</span> : row.status === "possible" ? <select className={selectClass} value={row.matchedParticipantId ?? ""} onChange={(event) => updateRow(row.key, { matchedParticipantId: event.target.value || null })}><option value="">Choose a possible match</option>{row.possibleParticipantIds.map((id) => <option key={id} value={id}>{participantName(participantMap[id])}</option>)}</select> : row.status === "new" ? <span className="text-blue-700"><UserPlus className="mr-1 inline h-4 w-4" />Create new participant</span> : <span className="text-slate-500">Skipped</span>}</td><td className="px-3 py-3"><div className="flex gap-2">{row.status === "possible" && row.matchedParticipantId && <Button size="sm" variant="outline" onClick={() => updateRow(row.key, { status: "possible" })}>Match</Button>}<Button size="sm" variant="outline" onClick={() => updateRow(row.key, { status: row.status === "skip" ? "new" : "skip", matchedParticipantId: row.status === "skip" ? null : row.matchedParticipantId })}><SkipForward className="mr-1 h-3.5 w-3.5" />{row.status === "skip" ? "Restore" : "Skip"}</Button></div></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </>}
    </PageContainer>
  </>
}
