import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"
import { parseActiveNetWorkbook, type ActiveNetRow, type ParsedActiveNetWorkbook } from "@/lib/services/activenetImport"
import { getParticipantDirectory, type ParticipantRecord } from "@/lib/services/participants"

export { parseActiveNetWorkbook }
export type { ActiveNetRow, ParsedActiveNetWorkbook }

export type ActiveNetMatchStatus = "exact" | "possible" | "new" | "skip"
export type ActiveNetReviewRow = ActiveNetRow & {
  key: string
  personKey: string
  status: ActiveNetMatchStatus
  matchedParticipantId: string | null
  possibleParticipantIds: string[]
  matchedTeamId: string | null
  matchReason: string
  missingFields: string[]
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
  participant_count: number
  matched_count: number
  new_count: number
  updated_count: number
  skipped_count: number
  created_at: string
}

type ImportAthlete = Pick<
  ParticipantRecord,
  | "id"
  | "external_id"
  | "gender"
  | "email"
  | "phone"
  | "emergency_contact_name"
  | "emergency_contact_phone"
>

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
const normEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase()
const normPhone = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "").slice(-10)
const fullName = (participant: ParticipantRecord) => `${participant.first_name} ${participant.last_name}`.trim()
const stableExternalId = (row: ActiveNetRow) => row.participantExternalId ? `activenet:${row.participantExternalId}` : ""
const personKeyFor = (row: ActiveNetRow) => row.participantExternalId
  ? `activenet:${norm(row.participantExternalId)}`
  : `name:${norm(row.participantName)}`

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

function missingProfileFields(row: ActiveNetRow, participant?: ParticipantRecord) {
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

function teamNameVariants(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return []
  const withoutCode = trimmed.replace(/^\s*[A-Za-z0-9]{2,8}\s*[-–—]+\s*/, "")
  return Array.from(new Set([norm(trimmed), norm(withoutCode)].filter(Boolean)))
}

async function loadPriorActiveNetLinks(externalIds: string[]) {
  if (!externalIds.length) return new Map<string, string>()
  const links = new Map<string, Set<string>>()

  for (let index = 0; index < externalIds.length; index += 250) {
    const chunk = externalIds.slice(index, index + 250)
    const { data, error } = await supabase
      .from("activenet_participant_records")
      .select("participant_external_id,athlete_id")
      .in("participant_external_id", chunk)
      .not("athlete_id", "is", null)
    if (error) throw error
    for (const row of data ?? []) {
      if (!row.participant_external_id || !row.athlete_id) continue
      const ids = links.get(row.participant_external_id) ?? new Set<string>()
      ids.add(row.athlete_id)
      links.set(row.participant_external_id, ids)
    }
  }

  return new Map(
    Array.from(links.entries())
      .filter(([, athleteIds]) => athleteIds.size === 1)
      .map(([externalId, athleteIds]) => [externalId, Array.from(athleteIds)[0]]),
  )
}

export async function buildActiveNetReview(parsed: ParsedActiveNetWorkbook) {
  if (parsed.workbookErrors.length) {
    throw new Error(`Required ActiveNet columns are missing: ${parsed.workbookErrors.join(", ")}`)
  }

  const directory = await getParticipantDirectory()
  const participants = directory.participants
  const participantById = new Map(participants.map((participant) => [participant.id, participant]))
  const participantsByName = new Map<string, ParticipantRecord[]>()
  const participantsByExternal = new Map<string, ParticipantRecord>()
  const sourceIdsByName = new Map<string, Set<string>>()

  for (const participant of participants) {
    const nameKey = norm(fullName(participant))
    participantsByName.set(nameKey, [...(participantsByName.get(nameKey) ?? []), participant])
    if (participant.external_id) participantsByExternal.set(norm(participant.external_id), participant)
  }
  for (const row of parsed.rows) {
    if (!row.participantExternalId) continue
    const nameKey = norm(row.participantName)
    const ids = sourceIdsByName.get(nameKey) ?? new Set<string>()
    ids.add(norm(row.participantExternalId))
    sourceIdsByName.set(nameKey, ids)
  }

  const priorLinks = await loadPriorActiveNetLinks(
    Array.from(new Set(parsed.rows.map((row) => row.participantExternalId).filter(Boolean))),
  )
  const teamByVariant = new Map<string, string[]>()
  for (const team of directory.teams) {
    for (const variant of teamNameVariants(team.name)) {
      teamByVariant.set(variant, [...(teamByVariant.get(variant) ?? []), team.id])
    }
  }

  const decisionByPerson = new Map<string, Omit<ActiveNetReviewRow, keyof ActiveNetRow | "key" | "personKey">>()
  const rows: ActiveNetReviewRow[] = []

  for (const row of parsed.rows) {
    const personKey = personKeyFor(row)
    const key = `${personKey}|${norm(row.seasonName)}|${norm(row.sessionName)}|row:${row.rowNumber}`

    let decision = decisionByPerson.get(personKey)
    if (!decision) {
      const nameKey = norm(row.participantName)
      const stableId = stableExternalId(row)
      const priorLinkedId = row.participantExternalId ? priorLinks.get(row.participantExternalId) : undefined
      const externalMatch = priorLinkedId
        ? participantById.get(priorLinkedId)
        : stableId
          ? participantsByExternal.get(norm(stableId)) ?? participantsByExternal.get(norm(row.participantExternalId))
          : undefined
      const sameName = participantsByName.get(nameKey) ?? []
      const sourceNameIsAmbiguous = (sourceIdsByName.get(nameKey)?.size ?? 0) > 1
      const nameMatch = !sourceNameIsAmbiguous && sameName.length === 1 ? sameName[0] : undefined
      const exact = externalMatch ?? nameMatch
      const possibleSet = new Set<string>()

      if (!exact) {
        for (const participant of participants) {
          const candidateName = norm(fullName(participant))
          const sameEmailAndLastName = row.email
            && normEmail(row.email) === normEmail(participant.email)
            && norm(row.lastName) === norm(participant.last_name)
          const samePhoneAndLastName = row.phone
            && normPhone(row.phone).length === 10
            && normPhone(row.phone) === normPhone(participant.phone)
            && norm(row.lastName) === norm(participant.last_name)
          const similarName = nameKey && candidateName && (
            editDistance(nameKey, candidateName) <= 2
            || (norm(row.lastName) === norm(participant.last_name) && norm(row.firstName).slice(0, 1) === norm(participant.first_name).slice(0, 1))
          )
          if (sameEmailAndLastName || samePhoneAndLastName || similarName) possibleSet.add(participant.id)
        }
      }

      const teamMatches = Array.from(new Set(
        teamNameVariants(row.teamName).flatMap((variant) => teamByVariant.get(variant) ?? []),
      ))
      const possibleParticipantIds = Array.from(possibleSet).slice(0, 8)
      const matchReason = priorLinkedId
        ? "ActiveNet ID from an earlier import"
        : externalMatch
          ? "ActiveNet participant ID"
          : nameMatch
            ? "unique exact name"
            : possibleParticipantIds.length
              ? "similar participant details"
              : ""

      decision = {
        status: row.errors.length ? "skip" : exact ? "exact" : possibleParticipantIds.length ? "possible" : "new",
        matchedParticipantId: exact?.id ?? null,
        possibleParticipantIds,
        matchedTeamId: teamMatches.length === 1 ? teamMatches[0] : null,
        matchReason,
        missingFields: missingProfileFields(row, exact),
      }
      decisionByPerson.set(personKey, decision)
    }

    rows.push({
      ...row,
      key,
      personKey,
      ...decision,
      status: row.errors.length ? "skip" : decision.status,
    })
  }
  return { participants, rows }
}

function profileUpdates(row: ActiveNetReviewRow, athlete: ImportAthlete) {
  const updates: Record<string, string> = {}
  const externalId = stableExternalId(row)
  if (!athlete.external_id && externalId) updates.external_id = externalId
  if (!athlete.gender && row.gender) updates.gender = row.gender
  if (!athlete.email && row.email) updates.email = row.email
  if (!athlete.phone && row.phone) updates.phone = row.phone
  if (!athlete.emergency_contact_name && row.guardianName) updates.emergency_contact_name = row.guardianName
  if (!athlete.emergency_contact_phone && row.emergencyContactPhone) updates.emergency_contact_phone = row.emergencyContactPhone
  return updates
}

export async function commitActiveNetImport(
  fileName: string,
  rows: ActiveNetReviewRow[],
  onProgress?: (progress: ActiveNetImportProgress) => void,
) {
  if (!fileName.trim()) throw new Error("Choose an ActiveNet file before importing.")
  const actionable = rows.filter((row) => row.status !== "skip")
  if (!actionable.length) throw new Error("There are no reviewed ActiveNet records available to import.")

  const unresolvedPeople = new Set(
    actionable
      .filter((row) => row.status === "possible" && !row.matchedParticipantId)
      .map((row) => row.personKey),
  )
  if (unresolvedPeople.size) throw new Error(`Resolve or skip ${unresolvedPeople.size} possible participant match${unresolvedPeople.size === 1 ? "" : "es"} before importing.`)

  const uniquePeople = new Map<string, ActiveNetReviewRow>()
  for (const row of actionable) if (!uniquePeople.has(row.personKey)) uniquePeople.set(row.personKey, row)

  const { organizationId, userId } = await getCurrentOrganizationContext()
  onProgress?.({ completed: 0, total: actionable.length, message: "Creating ActiveNet import record…" })

  const matchedPersonCount = Array.from(uniquePeople.values()).filter((row) => Boolean(row.matchedParticipantId)).length
  const { data: batch, error: batchError } = await supabase.from("activenet_imports").insert({
    organization_id: organizationId,
    file_name: fileName,
    row_count: rows.length,
    participant_count: uniquePeople.size,
    matched_count: matchedPersonCount,
    new_count: uniquePeople.size - matchedPersonCount,
    updated_count: 0,
    skipped_count: new Set(rows.filter((row) => row.status === "skip").map((row) => row.personKey)).size,
    created_by: userId,
  }).select("id").single()
  if (batchError) throw new Error(friendlyDatabaseError(batchError))

  try {
    const matchedIds = Array.from(new Set(actionable.map((row) => row.matchedParticipantId).filter((id): id is string => Boolean(id))))
    const athleteSnapshots = new Map<string, ImportAthlete>()
    const athletesWithTeams = new Set<string>()

    if (matchedIds.length) {
      const [{ data: athletes, error: athletesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
        supabase
          .from("athletes")
          .select("id,external_id,gender,email,phone,emergency_contact_name,emergency_contact_phone")
          .eq("organization_id", organizationId)
          .in("id", matchedIds),
        supabase
          .from("athlete_teams")
          .select("athlete_id")
          .eq("organization_id", organizationId)
          .eq("is_primary", true)
          .is("end_date", null)
          .in("athlete_id", matchedIds),
      ])
      if (athletesError) throw athletesError
      if (assignmentsError) throw assignmentsError
      for (const athlete of athletes ?? []) athleteSnapshots.set(athlete.id, athlete as ImportAthlete)
      for (const assignment of assignments ?? []) athletesWithTeams.add(assignment.athlete_id)
    }

    const athleteByPerson = new Map<string, string>()
    const createdAthletes = new Set<string>()
    const updatedAthletes = new Set<string>()
    const records: Array<Record<string, unknown>> = []
    let completed = 0

    for (const row of actionable) {
      let athleteId = athleteByPerson.get(row.personKey) ?? row.matchedParticipantId
      if (!athleteId) {
        onProgress?.({ completed, total: actionable.length, message: `Creating participant: ${row.participantName}` })
        const { data: athlete, error } = await supabase.from("athletes").insert({
          organization_id: organizationId,
          first_name: row.firstName,
          last_name: row.lastName,
          gender: row.gender || null,
          email: row.email || null,
          phone: row.phone || null,
          emergency_contact_name: row.guardianName || null,
          emergency_contact_phone: row.emergencyContactPhone || null,
          active: true,
          external_id: stableExternalId(row) || `activenet:${batch.id}:${norm(row.participantName)}`,
          notes: `Created from ActiveNet import ${fileName}${row.age !== null ? `; reported age ${row.age}` : ""}`,
        }).select("id,external_id,gender,email,phone,emergency_contact_name,emergency_contact_phone").single()
        if (error) throw error
        athleteId = athlete.id as string
        athleteSnapshots.set(athleteId, athlete as ImportAthlete)
        createdAthletes.add(athleteId)
      } else if (!athleteByPerson.has(row.personKey)) {
        const athlete = athleteSnapshots.get(athleteId)
        if (!athlete) throw new Error(`The selected ClayKeeper participant for ${row.participantName} is unavailable.`)
        const updates = profileUpdates(row, athlete)
        if (Object.keys(updates).length) {
          const { error } = await supabase
            .from("athletes")
            .update(updates)
            .eq("id", athleteId)
            .eq("organization_id", organizationId)
          if (error) throw error
          athleteSnapshots.set(athleteId, { ...athlete, ...updates })
          updatedAthletes.add(athleteId)
        }
      }

      athleteByPerson.set(row.personKey, athleteId)

      if (row.matchedTeamId && !athletesWithTeams.has(athleteId)) {
        const { error } = await supabase.from("athlete_teams").insert({
          organization_id: organizationId,
          athlete_id: athleteId,
          team_id: row.matchedTeamId,
          start_date: new Date().toISOString().slice(0, 10),
          is_primary: true,
        })
        if (error) throw error
        athletesWithTeams.add(athleteId)
        if (!createdAthletes.has(athleteId)) updatedAthletes.add(athleteId)
      }

      records.push({
        organization_id: organizationId,
        import_id: batch.id,
        athlete_id: athleteId,
        participant_external_id: row.participantExternalId || null,
        participant_name: row.participantName,
        gender: row.gender || null,
        guardian_name: row.guardianName || null,
        season_name: row.seasonName || null,
        session_name: row.sessionName || null,
        participant_age: row.age,
        source_row_number: row.rowNumber,
        source_data: row.sourceData,
        match_status: row.matchedParticipantId ? (row.status === "possible" ? "reviewed_match" : "exact_match") : "created_new",
      })
      completed += 1
      onProgress?.({ completed, total: actionable.length, message: `Preparing ${row.participantName}` })
    }

    const chunkSize = 250
    for (let index = 0; index < records.length; index += chunkSize) {
      const chunk = records.slice(index, index + chunkSize)
      onProgress?.({ completed: Math.min(index, records.length), total: records.length, message: "Saving ActiveNet registration records…" })
      const { error } = await supabase.from("activenet_participant_records").insert(chunk)
      if (error) throw error
    }

    const { error: summaryError } = await supabase
      .from("activenet_imports")
      .update({ updated_count: updatedAthletes.size })
      .eq("id", batch.id)
      .eq("organization_id", organizationId)
    if (summaryError) throw summaryError

    onProgress?.({ completed: records.length, total: records.length, message: "ActiveNet import completed." })
    return {
      importId: batch.id as string,
      imported: records.length,
      participants: uniquePeople.size,
      created: createdAthletes.size,
      updated: updatedAthletes.size,
      matched: matchedPersonCount,
    }
  } catch (error) {
    await supabase.from("activenet_imports").delete().eq("id", batch.id).eq("organization_id", organizationId)
    throw new Error(friendlyDatabaseError(error))
  }
}

export async function getActiveNetImportHistory() {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("activenet_imports")
    .select("id,file_name,row_count,participant_count,matched_count,new_count,updated_count,skipped_count,created_at")
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
