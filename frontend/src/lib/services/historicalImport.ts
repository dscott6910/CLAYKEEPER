import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationContext } from "@/lib/services/organizationContext"

export type ImportRow = {
  rowNumber: number
  firstName: string
  lastName: string
  team: string
  classCode: string
  squadNumber: string
  post: number | null
  scores: Array<number | null>
  total: number | null
  cyssaNumber: string
  amountPaid: number
  paymentStatus: string
  warnings: string[]
  errors: string[]
}

export type ParsedWorkbook = {
  fileName: string
  sheetName: string
  rows: ImportRow[]
  headers: string[]
}

const aliases: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first", "participant first name", "shooter first name"],
  lastName: ["last name", "lastname", "last", "participant last name", "shooter last name"],
  fullName: ["name", "participant", "participant name", "shooter", "shooter name", "athlete"],
  team: ["team", "team name", "club", "school"],
  classCode: ["class", "category", "division", "classification"],
  squadNumber: ["squad", "squad number", "squad #", "squad no"],
  post: ["post", "position", "station"],
  cyssaNumber: ["cyssa", "cyssa #", "cyssa number", "member number", "membership number"],
  amountPaid: ["amount paid", "paid", "payment", "total paid"],
  paymentStatus: ["payment status", "paid status"],
}

function norm(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

function findHeader(headers: string[], key: string): string | undefined {
  const candidates = aliases[key] ?? []
  return headers.find((h) => candidates.includes(norm(h)))
}

function numberValue(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function parseHistoricalWorkbook(file: File): Promise<ParsedWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.")
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "", raw: false })
  const headers = raw.length ? Object.keys(raw[0]) : []
  const firstHeader = findHeader(headers, "firstName")
  const lastHeader = findHeader(headers, "lastName")
  const fullHeader = findHeader(headers, "fullName")
  const teamHeader = findHeader(headers, "team")
  const classHeader = findHeader(headers, "classCode")
  const squadHeader = findHeader(headers, "squadNumber")
  const postHeader = findHeader(headers, "post")
  const cyssaHeader = findHeader(headers, "cyssaNumber")
  const paidHeader = findHeader(headers, "amountPaid")
  const paymentStatusHeader = findHeader(headers, "paymentStatus")
  const roundHeaders = headers
    .filter((h) => /^(r|round)\s*\d+$/i.test(h.trim()))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0))
  const totalHeader = headers.find((h) => ["total", "score", "total score"].includes(norm(h)))

  const rows = raw.map((record, index): ImportRow => {
    let firstName = firstHeader ? String(record[firstHeader] ?? "").trim() : ""
    let lastName = lastHeader ? String(record[lastHeader] ?? "").trim() : ""
    if ((!firstName || !lastName) && fullHeader) {
      const name = String(record[fullHeader] ?? "").trim()
      if (name.includes(",")) {
        const [last, first] = name.split(",", 2)
        firstName = first?.trim() ?? ""
        lastName = last?.trim() ?? ""
      } else {
        const parts = name.split(/\s+/)
        firstName = parts.shift() ?? ""
        lastName = parts.join(" ")
      }
    }
    const scores = roundHeaders.map((h) => numberValue(record[h]))
    const total = totalHeader ? numberValue(record[totalHeader]) : scores.some((s) => s !== null) ? scores.reduce<number>((sum, s) => sum + (s ?? 0), 0) : null
    const warnings: string[] = []
    const errors: string[] = []
    if (!firstName || !lastName) errors.push("Participant name is missing")
    if (!teamHeader || !String(record[teamHeader] ?? "").trim()) warnings.push("Team is blank")
    if (!classHeader || !String(record[classHeader] ?? "").trim()) warnings.push("Class is blank")
    if (!roundHeaders.length) errors.push("No round columns were detected")
    const calculated = scores.reduce<number>((sum, s) => sum + (s ?? 0), 0)
    if (total !== null && scores.some((s) => s !== null) && total !== calculated) warnings.push(`Total ${total} does not match rounds ${calculated}`)
    scores.forEach((score, i) => { if (score !== null && (score < 0 || score > 100)) errors.push(`Round ${i + 1} score is outside 0-100`) })
    return {
      rowNumber: index + 2,
      firstName,
      lastName,
      team: teamHeader ? String(record[teamHeader] ?? "").trim() : "",
      classCode: classHeader ? String(record[classHeader] ?? "").trim().toUpperCase() : "",
      squadNumber: squadHeader ? String(record[squadHeader] ?? "").trim() : "",
      post: postHeader ? numberValue(record[postHeader]) : null,
      scores,
      total,
      cyssaNumber: cyssaHeader ? String(record[cyssaHeader] ?? "").trim() : "",
      amountPaid: paidHeader ? numberValue(record[paidHeader]) ?? 0 : 0,
      paymentStatus: paymentStatusHeader ? String(record[paymentStatusHeader] ?? "").trim().toLowerCase() : "",
      warnings,
      errors,
    }
  }).filter((row) => row.firstName || row.lastName || row.team || row.scores.some((s) => s !== null))

  return { fileName: file.name, sheetName, rows, headers }
}

export type HistoricalImportOptions = {
  seasonId: string
  eventName: string
  shootName: string
  shootDate: string
  discipline: "american_trap" | "skeet" | "sporting_clays" | "bunker"
  locationName?: string
  entryFee: number
  organizationFee: number
}

async function singleId(table: string, selectQuery: () => PromiseLike<{ data: any; error: any }>) {
  const { data, error } = await selectQuery()
  if (error) throw error
  if (!data?.id) throw new Error(`Unable to resolve ${table}.`)
  return data.id as string
}

export async function importHistoricalShoot(parsed: ParsedWorkbook, options: HistoricalImportOptions) {
  const invalid = parsed.rows.filter((r) => r.errors.length)
  if (invalid.length) throw new Error(`Resolve ${invalid.length} row(s) with errors before importing.`)
  const { organizationId, userId } = await getCurrentOrganizationContext()

  const { data: importBatch, error: batchError } = await supabase.from("historical_imports").insert({
    organization_id: organizationId,
    season_id: options.seasonId,
    file_name: parsed.fileName,
    worksheet_name: parsed.sheetName,
    status: "importing",
    row_count: parsed.rows.length,
    warning_count: parsed.rows.reduce((n, r) => n + r.warnings.length, 0),
    source_rows: parsed.rows,
    created_by: userId,
  }).select("id").single()
  if (batchError) throw batchError

  try {
    let locationId: string | null = null
    if (options.locationName?.trim()) {
      const { data: existingLocation } = await supabase.from("locations").select("id").eq("organization_id", organizationId).ilike("name", options.locationName.trim()).maybeSingle()
      if (existingLocation?.id) locationId = existingLocation.id
      else locationId = await singleId("location", () => supabase.from("locations").insert({ organization_id: organizationId, name: options.locationName!.trim() }).select("id").single())
    }

    const eventId = await singleId("event", () => supabase.from("events").insert({
      organization_id: organizationId,
      season_id: options.seasonId,
      name: options.eventName.trim(),
      start_date: options.shootDate,
      end_date: options.shootDate,
      status: "completed",
      external_id: `historical:${importBatch.id}`,
      active: true,
      created_by: userId,
    }).select("id").single())

    const roundCount = Math.max(1, ...parsed.rows.map((r) => r.scores.length))
    const shootId = await singleId("shoot", () => supabase.from("shoots").insert({
      organization_id: organizationId,
      event_id: eventId,
      location_id: locationId,
      name: options.shootName.trim(),
      discipline: options.discipline,
      shoot_date: options.shootDate,
      entry_fee: options.entryFee,
      organization_fee: options.organizationFee,
      number_of_rounds: roundCount,
      status: "completed",
      allow_score_entry: false,
      external_id: `historical:${importBatch.id}`,
      created_by: userId,
    }).select("id").single())

    const teamCache = new Map<string, string>()
    const classCache = new Map<string, string>()
    const squadCache = new Map<string, string>()
    let imported = 0

    for (const row of parsed.rows) {
      let teamId: string | null = null
      if (row.team) {
        const key = norm(row.team)
        teamId = teamCache.get(key) ?? null
        if (!teamId) {
          const { data } = await supabase.from("teams").select("id").eq("organization_id", organizationId).ilike("name", row.team).maybeSingle()
          teamId = data?.id ?? await singleId("team", () => supabase.from("teams").insert({ organization_id: organizationId, name: row.team }).select("id").single())
          teamCache.set(key, teamId!)
        }
      }

      let classId: string | null = null
      if (row.classCode) {
        const key = norm(row.classCode)
        classId = classCache.get(key) ?? null
        if (!classId) {
          const { data } = await supabase.from("classes").select("id").eq("organization_id", organizationId).ilike("code", row.classCode).maybeSingle()
          classId = data?.id ?? await singleId("class", () => supabase.from("classes").insert({ organization_id: organizationId, code: row.classCode, display_name: row.classCode, display_order: 99 }).select("id").single())
          classCache.set(key, classId!)
        }
      }

      let athleteQuery = supabase.from("athletes").select("id").eq("organization_id", organizationId)
      athleteQuery = row.cyssaNumber ? athleteQuery.eq("cyssa_number", row.cyssaNumber) : athleteQuery.ilike("first_name", row.firstName).ilike("last_name", row.lastName)
      const { data: existingAthlete } = await athleteQuery.limit(1).maybeSingle()
      const athleteId = existingAthlete?.id ?? await singleId("athlete", () => supabase.from("athletes").insert({
        organization_id: organizationId,
        class_id: classId,
        first_name: row.firstName,
        last_name: row.lastName,
        cyssa_number: row.cyssaNumber || null,
        notes: `Created from historical import ${parsed.fileName}`,
      }).select("id").single())

      const registrationId = await singleId("registration", () => supabase.from("registrations").insert({
        organization_id: organizationId,
        event_id: eventId,
        athlete_id: athleteId,
        team_id: teamId,
        class_id: classId,
        status: "completed",
        registration_source: "historical_import",
        external_source: "claykeeper_excel",
        external_id: `${importBatch.id}:${row.rowNumber}`,
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        payment_status: row.paymentStatus === "paid" || row.amountPaid > 0 ? "paid" : "not_required",
        amount_paid: row.amountPaid,
        created_by: userId,
      }).select("id").single())

      const registrationShootId = await singleId("registration shoot", () => supabase.from("registration_shoots").insert({
        organization_id: organizationId,
        event_id: eventId,
        registration_id: registrationId,
        shoot_id: shootId,
        status: "completed",
        entry_fee: options.entryFee,
        organization_fee: options.organizationFee,
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        squad_assignment_status: row.squadNumber ? "assigned" : "not_required",
      }).select("id").single())

      if (row.squadNumber) {
        let squadId = squadCache.get(row.squadNumber)
        if (!squadId) {
          squadId = await singleId("squad", () => supabase.from("squads").insert({
            organization_id: organizationId,
            shoot_id: shootId,
            squad_number: row.squadNumber,
            name: `Squad ${row.squadNumber}`,
            capacity: Math.max(5, parsed.rows.filter((r) => r.squadNumber === row.squadNumber).length),
            assignment_method: "imported",
            status: "completed",
            created_by: userId,
          }).select("id").single())
          squadCache.set(row.squadNumber, squadId)
        }
        const usedPositions = parsed.rows.filter((r) => r.squadNumber === row.squadNumber && r.rowNumber < row.rowNumber).length
        const position = row.post && row.post > 0 ? Math.round(row.post) : usedPositions + 1
        const squadMemberId = await singleId("squad member", () => supabase.from("squad_members").insert({
          organization_id: organizationId,
          shoot_id: shootId,
          squad_id: squadId,
          registration_shoot_id: registrationShootId,
          position,
          position_label: `Post ${position}`,
          assignment_method: "imported",
          status: "completed",
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          assigned_by: userId,
        }).select("id").single())
        const scoreRows = row.scores.map((score, i) => ({
          organization_id: organizationId,
          event_id: eventId,
          shoot_id: shootId,
          squad_member_id: squadMemberId,
          round_number: i + 1,
          score,
          status: "verified",
          entered_by: userId,
        })).filter((entry) => entry.score !== null)
        if (scoreRows.length) {
          const { error } = await supabase.from("score_entries").insert(scoreRows)
          if (error) throw error
        }
      }
      imported += 1
    }

    await supabase.from("historical_imports").update({
      event_id: eventId,
      status: parsed.rows.some((r) => r.warnings.length) ? "completed_with_warnings" : "completed",
      imported_row_count: imported,
      import_summary: { eventId, shootId, teams: teamCache.size, classes: classCache.size, squads: squadCache.size },
      completed_at: new Date().toISOString(),
    }).eq("id", importBatch.id)
    return { eventId, shootId, imported }
  } catch (error) {
    await supabase.from("historical_imports").update({ status: "failed", error_count: 1, import_summary: { error: error instanceof Error ? error.message : String(error) }, completed_at: new Date().toISOString() }).eq("id", importBatch.id)
    throw error
  }
}
