import * as XLSX from "xlsx"

import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"
import { supabase } from "@/lib/supabase"

export type ActiveNetDiscipline = "american_trap" | "skeet" | "sporting_clays" | "bunker"

export type ActiveNetRow = {
  rowNumber: number
  participantName: string
  firstName: string
  lastName: string
  gender: string
  guardianName: string
  seasonName: string
  sessionName: string
  discipline: ActiveNetDiscipline | null
  age: number | null
  balance: number
  warnings: string[]
  errors: string[]
}

export type ParsedActiveNetWorkbook = {
  kind: "activenet"
  fileName: string
  sheetName: string
  rows: ActiveNetRow[]
  headers: string[]
  columnMapping: Record<string, string>
  workbookErrors: string[]
}

export type ActiveNetImportOptions = {
  seasonId: string
  eventName: string
  registrationDate: string
}

export type ActiveNetImportProgress = {
  message: string
  completedRows: number
  totalRows: number
  percent: number
  stage: "preparing" | "importing" | "finalizing" | "completed"
}

export type ActiveNetImportControl = {
  isCancelled?: () => boolean
  onImportCreated?: (importId: string) => void
  onProgress?: (progress: ActiveNetImportProgress) => void
}

export class ActiveNetImportCancelledError extends Error {
  constructor() {
    super("ActiveNet import cancelled by user")
    this.name = "ActiveNetImportCancelledError"
  }
}

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const text = (value: unknown) => String(value ?? "").trim()

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(String(value).replace(/[$,]/g, "").trim())
  return Number.isFinite(parsed) ? parsed : null
}

function splitParticipantName(fullName: string): { firstName: string; lastName: string } {
  const clean = fullName.replace(/\s+/g, " ").trim()
  if (!clean) return { firstName: "", lastName: "" }
  if (clean.includes(",")) {
    const [last, ...firstParts] = clean.split(",")
    return { firstName: firstParts.join(" ").trim(), lastName: last.trim() }
  }
  const parts = clean.split(" ")
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" }
}

function disciplineFromSession(sessionName: string): ActiveNetDiscipline | null {
  const session = normalize(sessionName)
  if (/\btrap\b/.test(session)) return "american_trap"
  if (/\bskeet\b/.test(session)) return "skeet"
  if (/sporting\s*clays?/.test(session)) return "sporting_clays"
  if (/\bbunker\b/.test(session)) return "bunker"
  return null
}

const aliases: Record<string, string[]> = {
  participantName: ["participant name", "participant: name", "name", "athlete name"],
  gender: ["participant gender", "participant: gender", "gender"],
  guardianName: ["primary p g name", "primary p/g: name", "primary parent guardian name", "parent guardian", "guardian name"],
  seasonName: ["season name", "season"],
  sessionName: ["session name", "session", "program name", "activity name"],
  age: ["participant age as of today", "participant: age as of today", "participant age", "age"],
  balance: ["balance", "outstanding balance", "amount due"],
}

function findHeader(headers: string[], field: keyof typeof aliases): number {
  const normalizedHeaders = headers.map(normalize)
  const candidates = aliases[field].map(normalize)
  return normalizedHeaders.findIndex((header) => candidates.includes(header))
}

export async function parseActiveNetWorkbook(file: File): Promise<ParsedActiveNetWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("The ActiveNet file does not contain a worksheet.")

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false })
  const headerRowIndex = matrix.findIndex((row) => row.some((cell) => aliases.participantName.map(normalize).includes(normalize(cell))))
  if (headerRowIndex < 0) throw new Error("ClayKeeper could not find an ActiveNet participant-name column.")

  const headers = matrix[headerRowIndex].map(text)
  const indexes = {
    participantName: findHeader(headers, "participantName"),
    gender: findHeader(headers, "gender"),
    guardianName: findHeader(headers, "guardianName"),
    seasonName: findHeader(headers, "seasonName"),
    sessionName: findHeader(headers, "sessionName"),
    age: findHeader(headers, "age"),
    balance: findHeader(headers, "balance"),
  }

  const workbookErrors: string[] = []
  if (indexes.participantName < 0) workbookErrors.push("Participant: Name")
  if (indexes.sessionName < 0) workbookErrors.push("Session name")
  if (indexes.seasonName < 0) workbookErrors.push("Season name")

  const rows: ActiveNetRow[] = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const record = matrix[rowIndex]
    const participantName = indexes.participantName >= 0 ? text(record[indexes.participantName]) : ""
    const sessionName = indexes.sessionName >= 0 ? text(record[indexes.sessionName]) : ""
    const seasonName = indexes.seasonName >= 0 ? text(record[indexes.seasonName]) : ""
    const gender = indexes.gender >= 0 ? text(record[indexes.gender]) : ""
    const guardianName = indexes.guardianName >= 0 ? text(record[indexes.guardianName]) : ""
    const age = indexes.age >= 0 ? numberValue(record[indexes.age]) : null
    const balance = indexes.balance >= 0 ? numberValue(record[indexes.balance]) ?? 0 : 0

    if (!participantName && !sessionName && !seasonName && !gender && !guardianName && age === null && balance === 0) continue

    const { firstName, lastName } = splitParticipantName(participantName)
    const discipline = disciplineFromSession(sessionName)
    const warnings: string[] = []
    const errors: string[] = []
    if (!firstName || !lastName) errors.push("Participant first and last name are required")
    if (!sessionName) errors.push("Session name is missing")
    else if (!discipline) errors.push(`Unsupported ActiveNet session: ${sessionName}`)
    if (!seasonName) warnings.push("ActiveNet season name is blank")
    if (!guardianName) warnings.push("Primary parent/guardian is blank")
    if (age !== null && (age < 0 || age > 100)) errors.push("Participant age is outside the expected range")
    if (balance < 0) warnings.push("Balance is negative")

    rows.push({
      rowNumber: rowIndex + 1,
      participantName,
      firstName,
      lastName,
      gender,
      guardianName,
      seasonName,
      sessionName,
      discipline,
      age,
      balance,
      warnings,
      errors,
    })
  }

  const columnMapping = Object.fromEntries(
    Object.entries(indexes)
      .filter(([, index]) => index >= 0)
      .map(([key, index]) => [key, headers[index]])
  )

  if (!rows.length && !workbookErrors.length) throw new Error("No ActiveNet registration rows were found.")
  return { kind: "activenet", fileName: file.name, sheetName, rows, headers, columnMapping, workbookErrors }
}

function throwIfCancelled(control?: ActiveNetImportControl) {
  if (control?.isCancelled?.()) throw new ActiveNetImportCancelledError()
}

async function requireId(label: string, query: PromiseLike<{ data: any; error: any }>): Promise<string> {
  const { data, error } = await query
  if (error) throw error
  if (!data?.id) throw new Error(`Unable to create ${label}.`)
  return data.id as string
}

export async function importActiveNetWorkbook(parsed: ParsedActiveNetWorkbook, options: ActiveNetImportOptions, control?: ActiveNetImportControl) {
  if (parsed.workbookErrors.length) throw new Error(`Required ActiveNet columns are missing: ${parsed.workbookErrors.join(", ")}`)
  const validRows = parsed.rows.filter((row) => !row.errors.length && row.discipline)
  const invalidRows = parsed.rows.filter((row) => row.errors.length || !row.discipline)
  if (!validRows.length) throw new Error("No valid ActiveNet registration rows are available to import.")

  throwIfCancelled(control)
  const { organizationId, userId } = await getCurrentOrganizationContext()
  const { data: importBatch, error: importError } = await supabase.from("historical_imports").insert({
    organization_id: organizationId,
    season_id: options.seasonId,
    file_name: parsed.fileName,
    worksheet_name: parsed.sheetName,
    status: "importing",
    row_count: parsed.rows.length,
    warning_count: parsed.rows.reduce((sum, row) => sum + row.warnings.length, 0),
    error_count: invalidRows.length,
    column_mapping: parsed.columnMapping,
    source_rows: parsed.rows,
    import_summary: { source: "activenet", phase: "starting" },
    created_by: userId,
  }).select("id").single()
  if (importError) throw importError
  control?.onImportCreated?.(importBatch.id)

  const report = (message: string, completedRows: number, stage: ActiveNetImportProgress["stage"]) => {
    const percent = stage === "completed" ? 100 : Math.min(99, Math.round((completedRows / validRows.length) * 100))
    control?.onProgress?.({ message, completedRows, totalRows: validRows.length, percent, stage })
  }

  let eventId: string | null = null
  try {
    report("Creating the ActiveNet registration container…", 0, "preparing")
    eventId = await requireId("ActiveNet event", supabase.from("events").insert({
      organization_id: organizationId,
      season_id: options.seasonId,
      name: options.eventName.trim(),
      description: `ActiveNet season registration import from ${parsed.fileName}`,
      start_date: options.registrationDate,
      end_date: options.registrationDate,
      status: "completed",
      external_id: `activenet:${importBatch.id}`,
      active: false,
      created_by: userId,
    }).select("id").single())

    const { error: linkError } = await supabase.from("historical_imports").update({
      event_id: eventId,
      import_summary: { source: "activenet", eventId, phase: "event_created" },
    }).eq("id", importBatch.id)
    if (linkError) throw linkError
    throwIfCancelled(control)

    const disciplineNames: Record<ActiveNetDiscipline, string> = {
      american_trap: "Trap",
      skeet: "Skeet",
      sporting_clays: "Sporting Clays",
      bunker: "Bunker",
    }
    const shootIds = new Map<ActiveNetDiscipline, string>()
    for (const discipline of [...new Set(validRows.map((row) => row.discipline!))]) {
      const id = await requireId(`${disciplineNames[discipline]} registration shoot`, supabase.from("shoots").insert({
        organization_id: organizationId,
        event_id: eventId,
        name: `${disciplineNames[discipline]} Registration`,
        discipline,
        shoot_date: options.registrationDate,
        entry_fee: 0,
        organization_fee: 0,
        targets_per_round: 25,
        number_of_rounds: 1,
        status: "completed",
        allow_score_entry: false,
        active: false,
        external_id: `activenet:${importBatch.id}:${discipline}`,
        notes: `Discipline enrollment imported from ${parsed.fileName}`,
        created_by: userId,
      }).select("id").single())
      shootIds.set(discipline, id)
    }

    const athleteCache = new Map<string, string>()
    const registrationCache = new Map<string, string>()
    const seenEnrollments = new Set<string>()
    let importedRows = 0
    let createdAthletes = 0
    let matchedAthletes = 0
    let duplicateRows = 0

    for (let index = 0; index < validRows.length; index += 1) {
      throwIfCancelled(control)
      const row = validRows[index]
      report(`Importing ${row.participantName}: ${row.sessionName}`, importedRows, "importing")
      const athleteKey = `${normalize(row.firstName)}|${normalize(row.lastName)}`
      let athleteId = athleteCache.get(athleteKey)
      if (!athleteId) {
        const { data: existingAthlete, error: findError } = await supabase.from("athletes")
          .select("id,gender,emergency_contact_name,notes")
          .eq("organization_id", organizationId)
          .ilike("first_name", row.firstName)
          .ilike("last_name", row.lastName)
          .limit(1)
          .maybeSingle()
        if (findError) throw findError
        if (existingAthlete?.id) {
          athleteId = existingAthlete.id
          matchedAthletes += 1
          const updates: Record<string, unknown> = {}
          if (!existingAthlete.gender && row.gender) updates.gender = row.gender
          if (!existingAthlete.emergency_contact_name && row.guardianName) updates.emergency_contact_name = row.guardianName
          if (Object.keys(updates).length) {
            const { error } = await supabase.from("athletes").update(updates).eq("id", athleteId)
            if (error) throw error
          }
        } else {
          athleteId = await requireId("athlete", supabase.from("athletes").insert({
            organization_id: organizationId,
            first_name: row.firstName,
            last_name: row.lastName,
            gender: row.gender || null,
            emergency_contact_name: row.guardianName || null,
            external_id: `activenet:${importBatch.id}:${athleteKey}`,
            notes: `Created from ActiveNet import ${parsed.fileName}${row.age !== null ? `; reported age ${row.age}` : ""}`,
          }).select("id").single())
          createdAthletes += 1
        }
        if (!athleteId) throw new Error(`Unable to resolve athlete ${row.participantName}.`)
        athleteCache.set(athleteKey, athleteId)
      }
      if (!athleteId) throw new Error(`Unable to resolve athlete ${row.participantName}.`)

      let registrationId = registrationCache.get(athleteId)
      if (!registrationId) {
        registrationId = await requireId("ActiveNet registration", supabase.from("registrations").insert({
          organization_id: organizationId,
          event_id: eventId,
          athlete_id: athleteId,
          status: "registered",
          registration_source: "activenet",
          external_source: "activenet_excel",
          external_id: `${importBatch.id}:${athleteKey}`,
          registered_at: new Date(`${options.registrationDate}T12:00:00`).toISOString(),
          payment_status: row.balance > 0 ? "unpaid" : "paid",
          registration_fee: Math.max(0, row.balance),
          amount_paid: 0,
          notes: `ActiveNet season: ${row.seasonName || "Not supplied"}. Primary P/G: ${row.guardianName || "Not supplied"}. Imported outstanding balance: $${row.balance.toFixed(2)}.`,
          created_by: userId,
        }).select("id").single())
        if (!registrationId) throw new Error(`Unable to resolve registration for ${row.participantName}.`)
        registrationCache.set(athleteId, registrationId)
      }
      if (!registrationId) throw new Error(`Unable to resolve registration for ${row.participantName}.`)

      const enrollmentKey = `${registrationId}|${row.discipline}`
      if (seenEnrollments.has(enrollmentKey)) {
        duplicateRows += 1
        continue
      }
      seenEnrollments.add(enrollmentKey)
      const shootId = shootIds.get(row.discipline!)
      if (!shootId) throw new Error(`No registration shoot exists for ${row.sessionName}.`)
      const { error: enrollmentError } = await supabase.from("registration_shoots").insert({
        organization_id: organizationId,
        event_id: eventId,
        registration_id: registrationId,
        shoot_id: shootId,
        status: "registered",
        entry_fee: 0,
        organization_fee: 0,
        notes: `ActiveNet session: ${row.sessionName}`,
      })
      if (enrollmentError) throw enrollmentError

      importedRows += 1
      if (importedRows % 10 === 0 || importedRows === validRows.length) {
        const { error: progressError } = await supabase.from("historical_imports").update({
          imported_row_count: importedRows,
          import_summary: { source: "activenet", eventId, phase: "importing", createdAthletes, matchedAthletes, duplicateRows },
        }).eq("id", importBatch.id)
        if (progressError) throw progressError
      }
    }

    report("Finalizing ActiveNet import…", importedRows, "finalizing")
    const status = invalidRows.length || parsed.rows.some((row) => row.warnings.length) || duplicateRows ? "completed_with_warnings" : "completed"
    const summary = {
      source: "activenet",
      eventId,
      importedRows,
      skippedRows: invalidRows.length,
      duplicateRows,
      uniqueParticipants: athleteCache.size,
      createdAthletes,
      matchedAthletes,
      disciplines: Object.fromEntries([...shootIds].map(([discipline, id]) => [discipline, id])),
    }
    const { error: completeError } = await supabase.from("historical_imports").update({
      status,
      imported_row_count: importedRows,
      error_count: invalidRows.length,
      import_summary: summary,
      completed_at: new Date().toISOString(),
    }).eq("id", importBatch.id)
    if (completeError) throw completeError

    report("ActiveNet import completed.", importedRows, "completed")
    return summary
  } catch (error) {
    const cancelled = error instanceof ActiveNetImportCancelledError
    await supabase.from("historical_imports").update({
      status: "failed",
      imported_row_count: 0,
      import_summary: { source: "activenet", eventId, cancelled, error: error instanceof Error ? error.message : String(error) },
      completed_at: new Date().toISOString(),
    }).eq("id", importBatch.id)
    throw error
  }
}
