import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"
import { parseActiveNetWorkbook, type ActiveNetRow, type ParsedActiveNetWorkbook } from "@/lib/services/activenetImport"
import { getParticipantDirectory, type ParticipantRecord } from "@/lib/services/participants"

export { parseActiveNetWorkbook }
export type { ActiveNetRow, ParsedActiveNetWorkbook }

export type ActiveNetMatchStatus = "exact" | "possible" | "new" | "skip"
export type ActiveNetReviewRow = ActiveNetRow & {
  key: string
  status: ActiveNetMatchStatus
  matchedParticipantId: string | null
  possibleParticipantIds: string[]
}

export type ActiveNetImportProgress = {
  completed: number
  total: number
  message: string
}

export type ActiveNetImportHistoryRow = {
  id: string
  file_name: string
  row_count: number
  matched_count: number
  new_count: number
  skipped_count: number
  created_at: string
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
const fullName = (participant: ParticipantRecord) => `${participant.first_name} ${participant.last_name}`.trim()

function editDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return rows[a.length][b.length]
}

function friendlyDatabaseError(error: unknown) {
  const candidate = error as { message?: string; details?: string; hint?: string; code?: string }
  return [candidate?.message, candidate?.details, candidate?.hint, candidate?.code ? `Code: ${candidate.code}` : ""]
    .filter(Boolean)
    .join(" — ") || "The ActiveNet import could not be saved."
}

export async function buildActiveNetReview(parsed: ParsedActiveNetWorkbook) {
  const directory = await getParticipantDirectory()
  const participants = directory.participants
  const byExact = new Map(participants.map((participant) => [norm(fullName(participant)), participant.id]))
  const seen = new Set<string>()
  const rows: ActiveNetReviewRow[] = []

  for (const row of parsed.rows) {
    const key = `${norm(row.participantName)}|${norm(row.seasonName)}|${norm(row.sessionName)}`
    if (seen.has(key)) continue
    seen.add(key)
    const exactId = byExact.get(norm(row.participantName)) ?? null
    const possible = exactId ? [] : participants
      .filter((participant) => {
        const a = norm(row.participantName)
        const b = norm(fullName(participant))
        return a && b && (editDistance(a, b) <= 2 || (norm(row.lastName) === norm(participant.last_name) && norm(row.firstName).slice(0, 1) === norm(participant.first_name).slice(0, 1)))
      })
      .slice(0, 8)
      .map((participant) => participant.id)

    rows.push({
      ...row,
      key,
      status: row.errors.length ? "skip" : exactId ? "exact" : possible.length ? "possible" : "new",
      matchedParticipantId: exactId,
      possibleParticipantIds: possible,
    })
  }
  return { participants, rows }
}

export async function commitActiveNetImport(
  fileName: string,
  rows: ActiveNetReviewRow[],
  onProgress?: (progress: ActiveNetImportProgress) => void,
) {
  if (!fileName.trim()) throw new Error("Choose an ActiveNet file before importing.")
  const actionable = rows.filter((row) => row.status !== "skip")
  if (!actionable.length) throw new Error("There are no reviewed ActiveNet records available to import.")

  const unresolved = actionable.filter((row) => row.status === "possible" && !row.matchedParticipantId)
  if (unresolved.length) throw new Error(`Resolve or skip ${unresolved.length} possible participant match${unresolved.length === 1 ? "" : "es"} before importing.`)

  const { organizationId, userId } = await getCurrentOrganizationContext()
  onProgress?.({ completed: 0, total: actionable.length, message: "Creating ActiveNet import record…" })

  const { data: batch, error: batchError } = await supabase.from("activenet_imports").insert({
    organization_id: organizationId,
    file_name: fileName,
    row_count: rows.length,
    matched_count: actionable.filter((row) => Boolean(row.matchedParticipantId)).length,
    new_count: actionable.filter((row) => !row.matchedParticipantId).length,
    skipped_count: rows.length - actionable.length,
    created_by: userId,
  }).select("id").single()
  if (batchError) throw new Error(friendlyDatabaseError(batchError))

  try {
    const athleteByName = new Map<string, string>()
    const records: Array<Record<string, unknown>> = []
    let completed = 0

    for (const row of actionable) {
      let athleteId = row.matchedParticipantId
      if (!athleteId) {
        const nameKey = norm(row.participantName)
        athleteId = athleteByName.get(nameKey) ?? null
        if (!athleteId) {
          onProgress?.({ completed, total: actionable.length, message: `Creating participant: ${row.participantName}` })
          const { data: athlete, error } = await supabase.from("athletes").insert({
            organization_id: organizationId,
            first_name: row.firstName,
            last_name: row.lastName,
            gender: row.gender || null,
            emergency_contact_name: row.guardianName || null,
            active: true,
            external_id: `activenet:${batch.id}:${nameKey}`,
          }).select("id").single()
          if (error) throw error
          athleteId = athlete.id as string
          athleteByName.set(nameKey, athleteId)
        }
      }

      records.push({
        organization_id: organizationId,
        import_id: batch.id,
        athlete_id: athleteId,
        participant_name: row.participantName,
        gender: row.gender || null,
        guardian_name: row.guardianName || null,
        season_name: row.seasonName || null,
        session_name: row.sessionName || null,
        participant_age: row.age,
        source_row_number: row.rowNumber,
        match_status: row.matchedParticipantId ? (row.status === "possible" ? "reviewed_match" : "exact_match") : "created_new",
      })
      completed += 1
      onProgress?.({ completed, total: actionable.length, message: `Preparing ${row.participantName}` })
    }

    const chunkSize = 250
    for (let index = 0; index < records.length; index += chunkSize) {
      const chunk = records.slice(index, index + chunkSize)
      onProgress?.({ completed: Math.min(index, records.length), total: records.length, message: "Saving ActiveNet participant records…" })
      const { error } = await supabase.from("activenet_participant_records").insert(chunk)
      if (error) throw error
    }

    onProgress?.({ completed: records.length, total: records.length, message: "ActiveNet import completed." })
    return { importId: batch.id as string, imported: records.length }
  } catch (error) {
    await supabase.from("activenet_imports").delete().eq("id", batch.id).eq("organization_id", organizationId)
    throw new Error(friendlyDatabaseError(error))
  }
}

export async function getActiveNetImportHistory() {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("activenet_imports")
    .select("id,file_name,row_count,matched_count,new_count,skipped_count,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(friendlyDatabaseError(error))
  return (data ?? []) as ActiveNetImportHistoryRow[]
}

export async function deleteActiveNetImport(importId: string) {
  const { organizationId } = await getCurrentOrganizationContext()
  const { error } = await supabase
    .from("activenet_imports")
    .delete()
    .eq("id", importId)
    .eq("organization_id", organizationId)
  if (error) throw new Error(friendlyDatabaseError(error))
}
