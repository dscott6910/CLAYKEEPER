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

export async function commitActiveNetImport(fileName: string, rows: ActiveNetReviewRow[]) {
  const { organizationId, userId } = await getCurrentOrganizationContext()
  const actionable = rows.filter((row) => row.status !== "skip")
  const { data: batch, error: batchError } = await supabase.from("activenet_imports").insert({
    organization_id: organizationId,
    file_name: fileName,
    row_count: rows.length,
    matched_count: actionable.filter((row) => Boolean(row.matchedParticipantId)).length,
    new_count: actionable.filter((row) => !row.matchedParticipantId).length,
    skipped_count: rows.length - actionable.length,
    created_by: userId,
  }).select("id").single()
  if (batchError) throw batchError

  const athleteByName = new Map<string, string>()
  const records = []
  for (const row of actionable) {
    let athleteId = row.matchedParticipantId
    if (!athleteId) {
      const nameKey = norm(row.participantName)
      athleteId = athleteByName.get(nameKey) ?? null
      if (!athleteId) {
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
        athleteId = athlete.id
        athleteByName.set(nameKey, athleteId as string)
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
  }
  if (records.length) {
    const { error } = await supabase.from("activenet_participant_records").insert(records)
    if (error) throw error
  }
  return { importId: batch.id, imported: records.length }
}
