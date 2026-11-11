import * as XLSX from "xlsx"

export type ActiveNetDiscipline = "american_trap" | "skeet" | "sporting_clays" | "bunker"

export type ActiveNetRow = {
  rowNumber: number
  participantName: string
  firstName: string
  lastName: string
  participantExternalId: string
  registrationStatus: string
  registeredAt: string
  teamName: string
  otherTeamName: string
  gender: string
  email: string
  phone: string
  addressLine1: string
  mailingAddress: string
  city: string
  state: string
  postalCode: string
  country: string
  grade: string
  priorShootingExperience: string
  guardianName: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactText: string
  emergencyContactEmail: string
  emergencyContactAddress: string
  primaryGuardianName: string
  primaryGuardianRelationship: string
  primaryGuardianHomePhone: string
  primaryGuardianBusinessPhone: string
  primaryGuardianCellPhone: string
  primaryGuardianAddress: string
  primaryGuardianAddressLine1: string
  primaryGuardianAddressLine2: string
  primaryGuardianCity: string
  primaryGuardianState: string
  primaryGuardianPostalCode: string
  primaryGuardianCountry: string
  primaryGuardianEmail: string
  secondaryGuardianName: string
  secondaryGuardianRelationship: string
  secondaryGuardianHomePhone: string
  secondaryGuardianBusinessPhone: string
  secondaryGuardianCellPhone: string
  secondaryGuardianAddress: string
  secondaryGuardianAddressLine1: string
  secondaryGuardianAddressLine2: string
  secondaryGuardianCity: string
  secondaryGuardianState: string
  secondaryGuardianPostalCode: string
  secondaryGuardianCountry: string
  secondaryGuardianEmail: string
  seasonName: string
  sessionName: string
  discipline: ActiveNetDiscipline | null
  age: number | null
  balance: number
  sourceData: Record<string, string>
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

function seasonFromSession(sessionName: string) {
  const match = sessionName.match(/\b(\d{4})\s*[-–—]\s*(\d{4})\b/)
  return match ? `${match[1]}-${match[2]}` : ""
}

const aliases = {
  registrationStatus: ["registration status"],
  registeredAt: ["date registered", "registration date"],
  teamName: ["participant what is the name of your team", "team name", "team"],
  otherTeamName: ["participant other team name", "other team name"],
  participantExternalId: ["participant id", "active participant id", "activenet participant id"],
  participantName: ["participant name", "participant name full", "name", "athlete name"],
  firstName: ["participant first name", "first name", "athlete first name"],
  lastName: ["participant last name", "last name", "athlete last name"],
  phone: ["participant home phone number", "participant phone", "home phone number", "phone"],
  addressLine1: ["participant address 1", "participant address", "address 1"],
  mailingAddress: ["participant please enter your mailing address", "participant mailing address", "mailing address"],
  city: ["participant city", "city"],
  state: ["participant state", "state"],
  postalCode: ["participant zip code", "participant postal code", "zip code", "postal code"],
  country: ["participant country", "country"],
  email: ["participant email address", "participant email", "email address", "email"],
  gender: ["participant gender", "gender"],
  age: ["participant age as of today", "participant age", "age"],
  grade: ["participant grade", "grade"],
  priorShootingExperience: [
    "participant has the registrant participated in shotgun shooting sports in cyssa or other similar organization before this year",
    "prior shooting experience",
  ],
  emergencyContactAddress: ["participant emergency contact physical address", "emergency contact physical address"],
  emergencyContactPhone: ["participant emergency contact cell phone", "emergency contact cell phone", "emergency contact phone"],
  emergencyContactText: ["participant emergency contact text number", "emergency contact text number"],
  emergencyContactEmail: ["participant emergency contact email", "emergency contact email"],
  emergencyContactName: [
    "participant name of secondary emergency contact different from the parent legal guardian details already provided",
    "secondary emergency contact name",
    "emergency contact name",
  ],
  guardianName: ["primary p g name", "primary parent guardian name", "parent guardian", "guardian name"],
  primaryGuardianFirstName: ["primary p g first name", "primary parent guardian first name"],
  primaryGuardianLastName: ["primary p g last name", "primary parent guardian last name"],
  primaryGuardianRelationship: ["primary p g relationship to registrant", "primary guardian relationship"],
  primaryGuardianHomePhone: ["primary p g home phone number", "primary guardian home phone number"],
  primaryGuardianBusinessPhone: ["primary p g business phone number", "primary guardian business phone number"],
  primaryGuardianCellPhone: ["primary p g cell phone number", "primary guardian cell phone number"],
  primaryGuardianAddress: ["primary p g address", "primary guardian address"],
  primaryGuardianAddressLine1: ["primary p g address 1", "primary guardian address 1"],
  primaryGuardianAddressLine2: ["primary p g address 2", "primary guardian address 2"],
  primaryGuardianCity: ["primary p g city", "primary guardian city"],
  primaryGuardianState: ["primary p g state", "primary guardian state"],
  primaryGuardianPostalCode: ["primary p g zip code", "primary guardian zip code"],
  primaryGuardianCountry: ["primary p g country", "primary guardian country"],
  primaryGuardianEmail: ["primary p g email address", "primary guardian email address"],
  secondaryGuardianFirstName: ["secondary p g first name", "secondary parent guardian first name"],
  secondaryGuardianLastName: ["secondary p g last name", "secondary parent guardian last name"],
  secondaryGuardianRelationship: ["secondary p g relationship to registrant", "secondary guardian relationship"],
  secondaryGuardianHomePhone: ["secondary p g home phone number", "secondary guardian home phone number"],
  secondaryGuardianBusinessPhone: ["secondary p g business phone number", "secondary guardian business phone number"],
  secondaryGuardianCellPhone: ["secondary p g cell phone number", "secondary guardian cell phone number"],
  secondaryGuardianAddress: ["secondary p g address", "secondary guardian address"],
  secondaryGuardianAddressLine1: ["secondary p g address 1", "secondary guardian address 1"],
  secondaryGuardianAddressLine2: ["secondary p g address 2", "secondary guardian address 2"],
  secondaryGuardianCity: ["secondary p g city", "secondary guardian city"],
  secondaryGuardianState: ["secondary p g state", "secondary guardian state"],
  secondaryGuardianPostalCode: ["secondary p g zip code", "secondary guardian zip code"],
  secondaryGuardianCountry: ["secondary p g country", "secondary guardian country"],
  secondaryGuardianEmail: ["secondary p g email address", "secondary guardian email address"],
  seasonName: ["season name", "season"],
  sessionName: ["session name", "session", "program name", "activity name"],
  balance: ["balance", "outstanding balance", "amount due"],
} satisfies Record<string, string[]>

type AliasField = keyof typeof aliases

function findHeader(headers: string[], field: AliasField): number {
  const normalizedHeaders = headers.map(normalize)
  const candidates = aliases[field].map(normalize)
  return normalizedHeaders.findIndex((header) => candidates.includes(header))
}

function joinedName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

export async function parseActiveNetWorkbook(file: File): Promise<ParsedActiveNetWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("The ActiveNet file does not contain a worksheet.")

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false })
  const headerRowIndex = matrix.findIndex((row) => {
    const normalized = row.map(normalize)
    const hasFullName = aliases.participantName.map(normalize).some((candidate) => normalized.includes(candidate))
    const hasFirstName = aliases.firstName.map(normalize).some((candidate) => normalized.includes(candidate))
    const hasLastName = aliases.lastName.map(normalize).some((candidate) => normalized.includes(candidate))
    return hasFullName || (hasFirstName && hasLastName)
  })
  if (headerRowIndex < 0) throw new Error("ClayKeeper could not find ActiveNet participant name columns.")

  const headers = matrix[headerRowIndex].map(text)
  const indexes = Object.fromEntries(
    (Object.keys(aliases) as AliasField[]).map((field) => [field, findHeader(headers, field)]),
  ) as Record<AliasField, number>
  const value = (record: unknown[], field: AliasField) => indexes[field] >= 0 ? text(record[indexes[field]]) : ""

  const workbookErrors: string[] = []
  if (indexes.participantName < 0 && (indexes.firstName < 0 || indexes.lastName < 0)) {
    workbookErrors.push("Participant name or first and last name")
  }
  if (indexes.sessionName < 0) workbookErrors.push("Session name")

  const rows: ActiveNetRow[] = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const record = matrix[rowIndex]
    const suppliedName = value(record, "participantName")
    const split = splitParticipantName(suppliedName)
    const firstName = value(record, "firstName") || split.firstName
    const lastName = value(record, "lastName") || split.lastName
    const participantName = suppliedName || joinedName(firstName, lastName)
    const participantExternalId = value(record, "participantExternalId")
    const registrationStatus = value(record, "registrationStatus")
    const sessionName = value(record, "sessionName")

    if (!participantName && !participantExternalId && !sessionName) continue
    if (/^count\s*:/i.test(registrationStatus) || /^count\s*:/i.test(participantName)) continue

    const seasonName = value(record, "seasonName") || seasonFromSession(sessionName)
    const primaryGuardianName = joinedName(value(record, "primaryGuardianFirstName"), value(record, "primaryGuardianLastName"))
    const secondaryGuardianName = joinedName(value(record, "secondaryGuardianFirstName"), value(record, "secondaryGuardianLastName"))
    const emergencyContactName = value(record, "emergencyContactName")
    const guardianName = value(record, "guardianName") || primaryGuardianName || emergencyContactName
    const age = indexes.age >= 0 ? numberValue(record[indexes.age]) : null
    const balance = indexes.balance >= 0 ? numberValue(record[indexes.balance]) ?? 0 : 0
    const discipline = disciplineFromSession(sessionName)
    const sourceData = Object.fromEntries(
      headers
        .map((header, index) => [header, text(record[index])] as const)
        .filter(([header, cellValue]) => header && cellValue),
    )
    const warnings: string[] = []
    const errors: string[] = []

    if (!firstName || !lastName) errors.push("Participant first and last name are required")
    if (!sessionName) errors.push("Session name is missing")
    else if (!discipline) errors.push(`Unsupported ActiveNet session: ${sessionName}`)
    if (!seasonName) warnings.push("ActiveNet season name is blank")
    if (!guardianName) warnings.push("Primary parent/guardian is blank")
    if (!participantExternalId) warnings.push("ActiveNet participant ID is blank")
    if (age !== null && (age < 0 || age > 100)) errors.push("Participant age is outside the expected range")
    if (balance < 0) warnings.push("Balance is negative")

    rows.push({
      rowNumber: rowIndex + 1,
      participantName,
      firstName,
      lastName,
      participantExternalId,
      registrationStatus,
      registeredAt: value(record, "registeredAt"),
      teamName: value(record, "teamName"),
      otherTeamName: value(record, "otherTeamName"),
      gender: value(record, "gender"),
      email: value(record, "email"),
      phone: value(record, "phone"),
      addressLine1: value(record, "addressLine1"),
      mailingAddress: value(record, "mailingAddress"),
      city: value(record, "city"),
      state: value(record, "state"),
      postalCode: value(record, "postalCode"),
      country: value(record, "country"),
      grade: value(record, "grade"),
      priorShootingExperience: value(record, "priorShootingExperience"),
      guardianName,
      emergencyContactName,
      emergencyContactPhone: value(record, "emergencyContactPhone") || value(record, "primaryGuardianCellPhone") || value(record, "primaryGuardianHomePhone"),
      emergencyContactText: value(record, "emergencyContactText"),
      emergencyContactEmail: value(record, "emergencyContactEmail"),
      emergencyContactAddress: value(record, "emergencyContactAddress"),
      primaryGuardianName,
      primaryGuardianRelationship: value(record, "primaryGuardianRelationship"),
      primaryGuardianHomePhone: value(record, "primaryGuardianHomePhone"),
      primaryGuardianBusinessPhone: value(record, "primaryGuardianBusinessPhone"),
      primaryGuardianCellPhone: value(record, "primaryGuardianCellPhone"),
      primaryGuardianAddress: value(record, "primaryGuardianAddress"),
      primaryGuardianAddressLine1: value(record, "primaryGuardianAddressLine1"),
      primaryGuardianAddressLine2: value(record, "primaryGuardianAddressLine2"),
      primaryGuardianCity: value(record, "primaryGuardianCity"),
      primaryGuardianState: value(record, "primaryGuardianState"),
      primaryGuardianPostalCode: value(record, "primaryGuardianPostalCode"),
      primaryGuardianCountry: value(record, "primaryGuardianCountry"),
      primaryGuardianEmail: value(record, "primaryGuardianEmail"),
      secondaryGuardianName,
      secondaryGuardianRelationship: value(record, "secondaryGuardianRelationship"),
      secondaryGuardianHomePhone: value(record, "secondaryGuardianHomePhone"),
      secondaryGuardianBusinessPhone: value(record, "secondaryGuardianBusinessPhone"),
      secondaryGuardianCellPhone: value(record, "secondaryGuardianCellPhone"),
      secondaryGuardianAddress: value(record, "secondaryGuardianAddress"),
      secondaryGuardianAddressLine1: value(record, "secondaryGuardianAddressLine1"),
      secondaryGuardianAddressLine2: value(record, "secondaryGuardianAddressLine2"),
      secondaryGuardianCity: value(record, "secondaryGuardianCity"),
      secondaryGuardianState: value(record, "secondaryGuardianState"),
      secondaryGuardianPostalCode: value(record, "secondaryGuardianPostalCode"),
      secondaryGuardianCountry: value(record, "secondaryGuardianCountry"),
      secondaryGuardianEmail: value(record, "secondaryGuardianEmail"),
      seasonName,
      sessionName,
      discipline,
      age,
      balance,
      sourceData,
      warnings,
      errors,
    })
  }

  const columnMapping = Object.fromEntries(
    Object.entries(indexes)
      .filter(([, index]) => index >= 0)
      .map(([key, index]) => [key, headers[index]]),
  )

  if (!rows.length && !workbookErrors.length) throw new Error("No ActiveNet registration rows were found.")
  return { kind: "activenet", fileName: file.name, sheetName, rows, headers, columnMapping, workbookErrors }
}
