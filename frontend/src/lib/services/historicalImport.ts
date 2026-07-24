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

export type UsOpenDiscipline = "american_trap" | "skeet" | "sporting_clays"

export type UsOpenRow = ImportRow & {
  discipline: UsOpenDiscipline
  sheetName: string
  first100Total: number | null
  resultNote: string
}

export type UsOpenSheet = {
  sheetName: string
  discipline: UsOpenDiscipline
  rows: UsOpenRow[]
  roundLabels: string[]
}

export type ParsedUsOpenWorkbook = {
  kind: "us_open"
  fileName: string
  sheets: UsOpenSheet[]
}

function sheetDiscipline(name: string): UsOpenDiscipline | null {
  const value = norm(name)
  if (value.includes("sporting")) return "sporting_clays"
  if (value.includes("skeet")) return "skeet"
  if (value.includes("trap")) return "american_trap"
  return null
}

function rawRowsForSheet(sheet: any): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true })
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function resultNoteFromRow(row: unknown[], startIndex: number) {
  return row.slice(startIndex).map(text).find(Boolean) ?? ""
}

export async function parseUsOpenWorkbook(file: File): Promise<ParsedUsOpenWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const sheets: UsOpenSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const discipline = sheetDiscipline(sheetName)
    if (!discipline) continue
    const matrix = rawRowsForSheet(workbook.Sheets[sheetName])
    const headerRow = matrix.findIndex((row) => row.some((cell) => norm(cell) === "lastname"))
    if (headerRow < 0) continue
    const headers = matrix[headerRow].map(text)
    const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(norm(header)))
    const lastIndex = indexOf("lastname", "last name")
    const firstIndex = indexOf("firstname", "first name")
    const teamIndex = indexOf("team short name", "team", "team name")
    const classIndex = indexOf("class", "category")
    const squadIndex = indexOf("squad number", "squad", "squad #")
    const totalIndex = indexOf("totalscore", "total score", "total")
    const first100Index = indexOf("totalscore first 100", "total score first 100", "first 100")
    const roundIndexes = headers
      .map((header, index) => ({ header, index, match: norm(header).match(/^(?:trap|skeet|round|r)\s*(\d+)$/) }))
      .filter((item) => item.match)
      .sort((a, b) => Number(a.match?.[1]) - Number(b.match?.[1]))
    const noteStart = Math.max(totalIndex, first100Index, ...roundIndexes.map((item) => item.index)) + 1

    const rows: UsOpenRow[] = []
    for (let rowIndex = headerRow + 1; rowIndex < matrix.length; rowIndex += 1) {
      const record = matrix[rowIndex]
      const firstName = firstIndex >= 0 ? text(record[firstIndex]) : ""
      const lastName = lastIndex >= 0 ? text(record[lastIndex]) : ""
      const team = teamIndex >= 0 ? text(record[teamIndex]) : ""
      const classCode = classIndex >= 0 ? text(record[classIndex]).toUpperCase() : ""
      const squadNumber = squadIndex >= 0 ? text(record[squadIndex]) : ""
      const total = totalIndex >= 0 ? numberValue(record[totalIndex]) : null
      const first100Total = first100Index >= 0 ? numberValue(record[first100Index]) : null
      const scores = roundIndexes.map((item) => numberValue(record[item.index]))
      if (!firstName && !lastName && !team && total === null && scores.every((score) => score === null)) continue

      const warnings: string[] = []
      const errors: string[] = []
      if (!firstName || !lastName) errors.push("Participant name is missing")
      if (!team) warnings.push("Team is blank")
      if (!classCode) warnings.push("Class is blank")
      scores.forEach((score, index) => {
        if (score !== null && (score < 0 || score > 25)) errors.push(`Round ${index + 1} score is outside 0-25`)
      })
      const enteredScores = scores.filter((score): score is number => score !== null)
      const calculated = enteredScores.reduce((sum, score) => sum + score, 0)
      if (enteredScores.length && total !== null && calculated !== total) warnings.push(`Total ${total} does not match entered rounds ${calculated}`)
      if (first100Total !== null && scores.slice(0, 4).some((score) => score !== null)) {
        const firstFour = scores.slice(0, 4).reduce<number>((sum, score) => sum + (score ?? 0), 0)
        if (firstFour !== first100Total) warnings.push(`First 100 total ${first100Total} does not match rounds 1-4 (${firstFour})`)
      }
      if (discipline === "sporting_clays" && total === null) errors.push("Total score is missing")
      if (discipline !== "sporting_clays" && !enteredScores.length) errors.push("No round scores were found")

      rows.push({
        rowNumber: rowIndex + 1,
        firstName,
        lastName,
        team,
        classCode,
        squadNumber,
        post: null,
        scores,
        total,
        cyssaNumber: "",
        amountPaid: 0,
        paymentStatus: "",
        warnings,
        errors,
        discipline,
        sheetName,
        first100Total,
        resultNote: resultNoteFromRow(record, noteStart),
      })
    }

    sheets.push({
      sheetName,
      discipline,
      rows,
      roundLabels: roundIndexes.map((item, index) => discipline === "skeet" ? `Skeet ${index + 1}` : item.header),
    })
  }

  if (!sheets.length) throw new Error("No SKEET, SPORTING CLAYS, or TRAP worksheets were detected.")
  return { kind: "us_open", fileName: file.name, sheets }
}

export type UsOpenImportOptions = {
  seasonId: string
  eventName: string
  eventDate: string
  locationName?: string
  trapEntryFee: number
  skeetEntryFee: number
  sportingEntryFee: number
  organizationFee: number
}

export async function importUsOpenWorkbook(parsed: ParsedUsOpenWorkbook, options: UsOpenImportOptions) {
  const allRows = parsed.sheets.flatMap((sheet) => sheet.rows)
  const invalid = allRows.filter((row) => row.errors.length)
  if (invalid.length) throw new Error(`Resolve ${invalid.length} row(s) with errors before importing.`)
  const { organizationId, userId } = await getCurrentOrganizationContext()

  const { data: importBatch, error: batchError } = await supabase.from("historical_imports").insert({
    organization_id: organizationId,
    season_id: options.seasonId,
    file_name: parsed.fileName,
    worksheet_name: parsed.sheets.map((sheet) => sheet.sheetName).join(", "),
    status: "importing",
    row_count: allRows.length,
    warning_count: allRows.reduce((count, row) => count + row.warnings.length, 0),
    source_rows: parsed.sheets,
    created_by: userId,
  }).select("id").single()
  if (batchError) throw batchError

  try {
    let locationId: string | null = null
    if (options.locationName?.trim()) {
      const { data: existing } = await supabase.from("locations").select("id").eq("organization_id", organizationId).ilike("name", options.locationName.trim()).maybeSingle()
      locationId = existing?.id ?? await singleId("location", () => supabase.from("locations").insert({ organization_id: organizationId, name: options.locationName!.trim() }).select("id").single())
    }

    const eventId = await singleId("event", () => supabase.from("events").insert({
      organization_id: organizationId,
      season_id: options.seasonId,
      name: options.eventName.trim(),
      start_date: options.eventDate,
      end_date: options.eventDate,
      status: "completed",
      external_id: `us-open:${importBatch.id}`,
      active: true,
      created_by: userId,
    }).select("id").single())

    const teamCache = new Map<string, string>()
    const classCache = new Map<string, string>()
    const athleteCache = new Map<string, string>()
    const registrationCache = new Map<string, string>()
    const shootIds: Record<string, string> = {}
    let importedRows = 0

    for (const sheet of parsed.sheets) {
      const entryFee = sheet.discipline === "american_trap" ? options.trapEntryFee : sheet.discipline === "skeet" ? options.skeetEntryFee : options.sportingEntryFee
      const roundCount = Math.max(1, ...sheet.rows.map((row) => row.scores.filter((score) => score !== null).length))
      const shootId = await singleId("shoot", () => supabase.from("shoots").insert({
        organization_id: organizationId,
        event_id: eventId,
        location_id: locationId,
        name: sheet.discipline === "american_trap" ? "Trap" : sheet.discipline === "skeet" ? "Skeet" : "Sporting Clays",
        discipline: sheet.discipline,
        shoot_date: options.eventDate,
        entry_fee: entryFee,
        organization_fee: options.organizationFee,
        targets_per_round: sheet.discipline === "sporting_clays" ? 1 : 25,
        number_of_rounds: roundCount,
        status: "completed",
        allow_score_entry: false,
        external_id: `us-open:${importBatch.id}:${sheet.sheetName}`,
        notes: `Imported from ${parsed.fileName}, worksheet ${sheet.sheetName}`,
        created_by: userId,
      }).select("id").single())
      shootIds[sheet.discipline] = shootId
      const squadCache = new Map<string, string>()

      for (const row of sheet.rows) {
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

        const athleteKey = `${norm(row.firstName)}|${norm(row.lastName)}`
        let athleteId = athleteCache.get(athleteKey)
        if (!athleteId) {
          const { data } = await supabase.from("athletes").select("id").eq("organization_id", organizationId).ilike("first_name", row.firstName).ilike("last_name", row.lastName).limit(1).maybeSingle()
          athleteId = data?.id ?? await singleId("athlete", () => supabase.from("athletes").insert({
            organization_id: organizationId,
            class_id: classId,
            first_name: row.firstName,
            last_name: row.lastName,
            notes: `Created from 2026 US Open import ${parsed.fileName}`,
          }).select("id").single())
          athleteCache.set(athleteKey, athleteId!)
        }

        let registrationId = registrationCache.get(athleteId!)
        if (!registrationId) {
          registrationId = await singleId("registration", () => supabase.from("registrations").insert({
            organization_id: organizationId,
            event_id: eventId,
            athlete_id: athleteId,
            team_id: teamId,
            class_id: classId,
            status: "completed",
            registration_source: "historical_import",
            external_source: "claykeeper_us_open_excel",
            external_id: `${importBatch.id}:${athleteKey}`,
            checked_in: true,
            checked_in_at: new Date().toISOString(),
            payment_status: "not_required",
            amount_paid: 0,
            created_by: userId,
          }).select("id").single())
          registrationCache.set(athleteId!, registrationId!)
        }

        const registrationShootId = await singleId("registration shoot", () => supabase.from("registration_shoots").insert({
          organization_id: organizationId,
          event_id: eventId,
          registration_id: registrationId,
          shoot_id: shootId,
          status: "completed",
          entry_fee: entryFee,
          organization_fee: options.organizationFee,
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          squad_assignment_status: row.squadNumber ? "assigned" : "not_required",
          historical_total_score: row.total,
          historical_first_100_total: row.first100Total,
          result_note: row.resultNote || null,
          source_sheet: row.sheetName,
          notes: row.resultNote ? `Imported result: ${row.resultNote}` : null,
        }).select("id").single())

        if (row.squadNumber) {
          let squadId = squadCache.get(row.squadNumber)
          if (!squadId) {
            const memberCount = sheet.rows.filter((candidate) => candidate.squadNumber === row.squadNumber).length
            squadId = await singleId("squad", () => supabase.from("squads").insert({
              organization_id: organizationId,
              shoot_id: shootId,
              squad_number: row.squadNumber,
              name: `Squad ${row.squadNumber}`,
              capacity: Math.max(5, memberCount),
              assignment_method: "imported",
              status: "completed",
              created_by: userId,
            }).select("id").single())
            squadCache.set(row.squadNumber, squadId)
          }
          const position = sheet.rows.filter((candidate) => candidate.squadNumber === row.squadNumber && candidate.rowNumber <= row.rowNumber).length
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
          const scoreRows = row.scores.map((score, index) => ({
            organization_id: organizationId,
            event_id: eventId,
            shoot_id: shootId,
            squad_member_id: squadMemberId,
            round_number: index + 1,
            score,
            status: "verified",
            entered_by: userId,
          })).filter((entry) => entry.score !== null)
          if (scoreRows.length) {
            const { error } = await supabase.from("score_entries").insert(scoreRows)
            if (error) throw error
          }
        }
        importedRows += 1
      }
    }

    await supabase.from("historical_imports").update({
      event_id: eventId,
      status: allRows.some((row) => row.warnings.length) ? "completed_with_warnings" : "completed",
      imported_row_count: importedRows,
      import_summary: { eventId, shootIds, uniqueParticipants: athleteCache.size, teams: teamCache.size, classes: classCache.size },
      completed_at: new Date().toISOString(),
    }).eq("id", importBatch.id)

    return { eventId, shootIds, importedRows, uniqueParticipants: athleteCache.size }
  } catch (error) {
    await supabase.from("historical_imports").update({ status: "failed", error_count: 1, import_summary: { error: error instanceof Error ? error.message : String(error) }, completed_at: new Date().toISOString() }).eq("id", importBatch.id)
    throw error
  }
}

export type TrapSeriesRow = ImportRow & {
  sheetName: string
}

export type TrapSeriesSheet = {
  sheetName: string
  rows: TrapSeriesRow[]
  hasSquadNumbers: boolean
}

export type ParsedTrapSeriesWorkbook = {
  kind: "trap_series"
  fileName: string
  sheets: TrapSeriesSheet[]
}

export async function parseTrapSeriesWorkbook(file: File): Promise<ParsedTrapSeriesWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const sheets: TrapSeriesSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const matrix = rawRowsForSheet(workbook.Sheets[sheetName])
    const headerRow = matrix.findIndex((row) => row.some((cell) => norm(cell) === "lastname"))
    if (headerRow < 0) continue

    const headers = matrix[headerRow].map(text)
    const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(norm(header)))
    const lastIndex = indexOf("lastname", "last name")
    const firstIndex = indexOf("firstname", "first name")
    const teamIndex = indexOf("team short name", "team", "team name")
    const squadIndex = indexOf("squad number", "squad", "squad #")
    const classIndex = indexOf("class", "category")
    const totalIndex = indexOf("totalscore", "total score", "total")
    const roundIndexes = headers
      .map((header, index) => ({ header, index, match: norm(header).match(/^trap\s*(\d+)$/) }))
      .filter((item) => item.match)
      .sort((a, b) => Number(a.match?.[1]) - Number(b.match?.[1]))

    if (lastIndex < 0 || firstIndex < 0 || totalIndex < 0 || !roundIndexes.length) continue

    const rows: TrapSeriesRow[] = []
    for (let rowIndex = headerRow + 1; rowIndex < matrix.length; rowIndex += 1) {
      const record = matrix[rowIndex]
      const firstName = text(record[firstIndex])
      const lastName = text(record[lastIndex])
      const team = teamIndex >= 0 ? text(record[teamIndex]) : ""
      const classCode = classIndex >= 0 ? text(record[classIndex]).toUpperCase() : ""
      const squadNumber = squadIndex >= 0 ? text(record[squadIndex]) : ""
      const total = numberValue(record[totalIndex])
      const scores = roundIndexes.map((item) => numberValue(record[item.index]))

      if (!firstName && !lastName && !team && total === null && scores.every((score) => score === null)) continue

      const warnings: string[] = []
      const errors: string[] = []
      if (!firstName || !lastName) errors.push("Participant name is missing")
      if (!team) warnings.push("Team is blank")
      if (!classCode) warnings.push("Class is blank")
      if (!squadNumber) warnings.push("Squad number is blank; ClayKeeper will create an imported holding squad")
      scores.forEach((score, index) => {
        if (score !== null && (score < 0 || score > 25)) errors.push(`Round ${index + 1} score is outside 0-25`)
      })
      const calculated = scores.reduce<number>((sum, score) => sum + (score ?? 0), 0)
      if (total === null) errors.push("Total score is missing")
      else if (scores.some((score) => score !== null) && calculated !== total) warnings.push(`Total ${total} does not match rounds ${calculated}`)

      rows.push({
        rowNumber: rowIndex + 1,
        firstName,
        lastName,
        team,
        classCode,
        squadNumber,
        post: null,
        scores,
        total,
        cyssaNumber: "",
        amountPaid: 0,
        paymentStatus: "",
        warnings,
        errors,
        sheetName,
      })
    }

    if (rows.length) sheets.push({ sheetName, rows, hasSquadNumbers: squadIndex >= 0 })
  }

  if (!sheets.length) throw new Error("No Trap Series worksheets were detected. Each shoot sheet must contain LASTNAME, FIRSTNAME, TOTALSCORE, and TRAP 1-4 columns.")
  return { kind: "trap_series", fileName: file.name, sheets }
}

export type TrapSeriesImportOptions = {
  seasonId: string
  eventName: string
  eventDate: string
  entryFee: number
  organizationFee: number
}

export async function importTrapSeriesWorkbook(parsed: ParsedTrapSeriesWorkbook, options: TrapSeriesImportOptions) {
  const allRows = parsed.sheets.flatMap((sheet) => sheet.rows)
  const validSheets = parsed.sheets
    .map((sheet) => ({ ...sheet, rows: sheet.rows.filter((row) => !row.errors.length) }))
    .filter((sheet) => sheet.rows.length > 0)
  const skippedRows = allRows.filter((row) => row.errors.length)
  if (!validSheets.length) throw new Error("No valid Trap Series rows are available to import.")

  const { organizationId, userId } = await getCurrentOrganizationContext()
  const { data: importBatch, error: batchError } = await supabase.from("historical_imports").insert({
    organization_id: organizationId,
    season_id: options.seasonId,
    file_name: parsed.fileName,
    worksheet_name: parsed.sheets.map((sheet) => sheet.sheetName).join(", "),
    status: "importing",
    row_count: allRows.length,
    warning_count: allRows.reduce((count, row) => count + row.warnings.length, 0),
    error_count: skippedRows.length,
    source_rows: parsed.sheets,
    created_by: userId,
  }).select("id").single()
  if (batchError) throw batchError

  try {
    const eventId = await singleId("event", () => supabase.from("events").insert({
      organization_id: organizationId,
      season_id: options.seasonId,
      name: options.eventName.trim(),
      start_date: options.eventDate,
      end_date: options.eventDate,
      status: "completed",
      external_id: `trap-series:${importBatch.id}`,
      active: true,
      created_by: userId,
    }).select("id").single())

    const teamCache = new Map<string, string>()
    const classCache = new Map<string, string>()
    const athleteCache = new Map<string, string>()
    const registrationCache = new Map<string, string>()
    const shootIds: Record<string, string> = {}
    let importedRows = 0

    for (const sheet of validSheets) {
      let locationId: string | null = null
      const { data: existingLocation } = await supabase.from("locations").select("id").eq("organization_id", organizationId).ilike("name", sheet.sheetName).maybeSingle()
      locationId = existingLocation?.id ?? await singleId("location", () => supabase.from("locations").insert({ organization_id: organizationId, name: sheet.sheetName }).select("id").single())

      const shootId = await singleId("shoot", () => supabase.from("shoots").insert({
        organization_id: organizationId,
        event_id: eventId,
        location_id: locationId,
        name: sheet.sheetName,
        discipline: "american_trap",
        shoot_date: options.eventDate,
        entry_fee: options.entryFee,
        organization_fee: options.organizationFee,
        targets_per_round: 25,
        number_of_rounds: 4,
        status: "completed",
        allow_score_entry: false,
        external_id: `trap-series:${importBatch.id}:${sheet.sheetName}`,
        notes: `Imported from ${parsed.fileName}, worksheet ${sheet.sheetName}`,
        created_by: userId,
      }).select("id").single())
      shootIds[sheet.sheetName] = shootId

      const squadCache = new Map<string, string>()
      const rowsBySquad = new Map<string, TrapSeriesRow[]>()
      sheet.rows.forEach((row, index) => {
        const effectiveSquad = row.squadNumber || `Imported ${Math.floor(index / 5) + 1}`
        const list = rowsBySquad.get(effectiveSquad) ?? []
        list.push(row)
        rowsBySquad.set(effectiveSquad, list)
      })

      for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
        const row = sheet.rows[rowIndex]
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

        const athleteKey = `${norm(row.firstName)}|${norm(row.lastName)}`
        let athleteId = athleteCache.get(athleteKey)
        if (!athleteId) {
          const { data } = await supabase.from("athletes").select("id").eq("organization_id", organizationId).ilike("first_name", row.firstName).ilike("last_name", row.lastName).limit(1).maybeSingle()
          athleteId = data?.id ?? await singleId("athlete", () => supabase.from("athletes").insert({
            organization_id: organizationId,
            class_id: classId,
            first_name: row.firstName,
            last_name: row.lastName,
            notes: `Created from Trap Series import ${parsed.fileName}`,
          }).select("id").single())
          athleteCache.set(athleteKey, athleteId!)
        }

        let registrationId = registrationCache.get(athleteId!)
        if (!registrationId) {
          registrationId = await singleId("registration", () => supabase.from("registrations").insert({
            organization_id: organizationId,
            event_id: eventId,
            athlete_id: athleteId,
            team_id: teamId,
            class_id: classId,
            status: "completed",
            registration_source: "historical_import",
            external_source: "claykeeper_trap_series_excel",
            external_id: `${importBatch.id}:${athleteKey}`,
            checked_in: true,
            checked_in_at: new Date().toISOString(),
            payment_status: "not_required",
            amount_paid: 0,
            created_by: userId,
          }).select("id").single())
          registrationCache.set(athleteId!, registrationId!)
        }

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
          squad_assignment_status: "assigned",
          historical_total_score: row.total,
          source_sheet: row.sheetName,
        }).select("id").single())

        const effectiveSquad = row.squadNumber || `Imported ${Math.floor(rowIndex / 5) + 1}`
        let squadId = squadCache.get(effectiveSquad)
        if (!squadId) {
          const memberCount = rowsBySquad.get(effectiveSquad)?.length ?? 5
          squadId = await singleId("squad", () => supabase.from("squads").insert({
            organization_id: organizationId,
            shoot_id: shootId,
            squad_number: effectiveSquad,
            name: row.squadNumber ? `Squad ${effectiveSquad}` : effectiveSquad,
            capacity: Math.max(5, memberCount),
            assignment_method: "imported",
            status: "completed",
            created_by: userId,
          }).select("id").single())
          squadCache.set(effectiveSquad, squadId)
        }

        const position = sheet.rows.filter((candidate, candidateIndex) => {
          const candidateSquad = candidate.squadNumber || `Imported ${Math.floor(candidateIndex / 5) + 1}`
          return candidateSquad === effectiveSquad && candidateIndex <= rowIndex
        }).length
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

        const scoreRows = row.scores.map((score, index) => ({
          organization_id: organizationId,
          event_id: eventId,
          shoot_id: shootId,
          squad_member_id: squadMemberId,
          round_number: index + 1,
          score,
          status: "verified",
          entered_by: userId,
        })).filter((entry) => entry.score !== null)
        if (scoreRows.length) {
          const { error } = await supabase.from("score_entries").insert(scoreRows)
          if (error) throw error
        }
        importedRows += 1
      }
    }

    await supabase.from("historical_imports").update({
      event_id: eventId,
      status: skippedRows.length || allRows.some((row) => row.warnings.length) ? "completed_with_warnings" : "completed",
      imported_row_count: importedRows,
      import_summary: { eventId, shootIds, uniqueParticipants: athleteCache.size, teams: teamCache.size, classes: classCache.size, skippedRows: skippedRows.map((row) => ({ sheetName: row.sheetName, rowNumber: row.rowNumber, errors: row.errors })) },
      completed_at: new Date().toISOString(),
    }).eq("id", importBatch.id)

    return { eventId, shootIds, importedRows, uniqueParticipants: athleteCache.size, skippedRows: skippedRows.length }
  } catch (error) {
    await supabase.from("historical_imports").update({ status: "failed", error_count: 1, import_summary: { error: error instanceof Error ? error.message : String(error) }, completed_at: new Date().toISOString() }).eq("id", importBatch.id)
    throw error
  }
}


export type HistoricalImportRecord = {
  id: string
  event_id: string | null
  file_name: string
  worksheet_name: string | null
  status: string
  row_count: number
  imported_row_count: number
  warning_count: number
  error_count: number
  created_at: string
  completed_at: string | null
  import_summary: Record<string, unknown> | null
}

export async function listHistoricalImports(): Promise<HistoricalImportRecord[]> {
  const { organizationId } = await getCurrentOrganizationContext()
  const { data, error } = await supabase
    .from("historical_imports")
    .select("id,event_id,file_name,worksheet_name,status,row_count,imported_row_count,warning_count,error_count,created_at,completed_at,import_summary")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as HistoricalImportRecord[]
}

export type DeleteHistoricalImportResult = {
  deleted: boolean
  importId: string
  eventId: string | null
  eventName: string | null
  fileName: string
}

export async function deleteHistoricalImport(importId: string): Promise<DeleteHistoricalImportResult> {
  const { data, error } = await supabase.rpc("delete_historical_import_v3", { p_import_id: importId })
  if (error) {
    const message = error.message ?? "Unable to delete import"
    if (message.includes("delete_historical_import_v3") || message.includes("schema cache")) {
      throw new Error("The Delete Import database update has not been installed. Run RUN_THIS_SQL_FIRST_historical_import_delete_v3.sql in the Supabase SQL Editor, then try again.")
    }
    throw new Error(message)
  }
  if (!data || typeof data !== "object" || !(data as { deleted?: boolean }).deleted) {
    throw new Error("Supabase did not confirm that the import was deleted.")
  }
  return data as DeleteHistoricalImportResult
}
