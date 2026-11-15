export const CYSSA_CLASSES = ["IA", "IE", "R", "JV", "VR", "YA"] as const
export type CyssaClass = typeof CYSSA_CLASSES[number]
export type DisciplineKey = "trap" | "skeet" | "sporting_clays"
export type MeetType = "series" | "state"

export type AwardParticipant = {
  enrollmentId: string
  memberId?: string
  squadId?: string
  name: string
  team: string
  classCode: string
  squad: string
  total: number
  complete: boolean
  shootOffs: number[]
}

export type RankedParticipant = AwardParticipant & { place: number; unresolvedTie: boolean }
export type GroupResult = {
  label: string
  category: string
  members: AwardParticipant[]
  total: number
  eligible: boolean
  place: number | null
  unresolvedTie: boolean
  tieBreakerScore: number | null
}

export function normalizeDiscipline(value?: string | null): DisciplineKey {
  const text = (value || "").toLowerCase()
  if (text.includes("sport")) return "sporting_clays"
  if (text.includes("skeet")) return "skeet"
  return "trap"
}

export function compareParticipants(a: AwardParticipant, b: AwardParticipant) {
  if (b.total !== a.total) return b.total - a.total
  const count = Math.max(a.shootOffs.length, b.shootOffs.length)
  for (let index = 0; index < count; index += 1) {
    const delta = (b.shootOffs[index] ?? -1) - (a.shootOffs[index] ?? -1)
    if (delta !== 0) return delta
  }
  return a.name.localeCompare(b.name)
}

export function sameCompetitiveScore(a: AwardParticipant, b: AwardParticipant) {
  if (a.total !== b.total) return false
  const count = Math.max(a.shootOffs.length, b.shootOffs.length)
  for (let index = 0; index < count; index += 1) {
    if ((a.shootOffs[index] ?? null) !== (b.shootOffs[index] ?? null)) return false
  }
  return true
}

export function individualPlacementCount(meetType: MeetType, classCode: string) {
  if (meetType === "state" && ["IA", "IE", "R"].includes(classCode.toUpperCase())) return 5
  return 3
}

export function rankIndividuals(rows: AwardParticipant[], limit: number): RankedParticipant[] {
  const complete = rows.filter((row) => row.complete)
  const rounds = Math.max(0, ...complete.map((row) => row.shootOffs.length))
  function resolve(group: AwardParticipant[], round: number): AwardParticipant[][] {
    if (group.length < 2 || round >= rounds) return [group]
    const values = group.map((row) => row.shootOffs[round] ?? -1)
    // A global shoot-off round may belong to another class or an earlier tie.
    if (values.every((score) => score < 0)) return resolve(group, round + 1)
    if (values.some((score) => score < 0)) return [group]
    return [...new Set(values)].sort((a, b) => b - a).flatMap((score) =>
      resolve(group.filter((row) => row.shootOffs[round] === score), round + 1),
    )
  }
  const groups = [...new Set(complete.map((row) => row.total))].sort((a, b) => b - a)
    .flatMap((total) => resolve(complete.filter((row) => row.total === total), 0))
  const ranked: RankedParticipant[] = []
  let place = 1
  for (const group of groups) {
    if (place > limit) break
    group.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((row) =>
      ranked.push({ ...row, place, unresolvedTie: group.length > 1 }),
    )
    place += group.length
  }

  return ranked
}

export function classAwardGroups(rows: AwardParticipant[], meetType: MeetType) {
  return CYSSA_CLASSES.map((classCode) => ({
    classCode,
    rows: rankIndividuals(rows.filter((row) => row.classCode.toUpperCase() === classCode), individualPlacementCount(meetType, classCode)),
  }))
}

function teamHighCategory(classCode: string) {
  const code = classCode.toUpperCase()
  if (code === "VR") return "VR"
  if (code === "JV") return "JV"
  if (["IA", "IE", "R"].includes(code)) return "IA / IE / R"
  return null
}

function compareGroup(a: Omit<GroupResult, "place" | "unresolvedTie">, b: Omit<GroupResult, "place" | "unresolvedTie">) {
  if (b.total !== a.total) return b.total - a.total
  const aTie = a.tieBreakerScore ?? -1
  const bTie = b.tieBreakerScore ?? -1
  if (bTie !== aTie) return bTie - aTie
  return a.label.localeCompare(b.label)
}

function finalizeGroups(rows: Array<Omit<GroupResult, "place" | "unresolvedTie">>, placements = 3): GroupResult[] {
  const categories = Array.from(new Set(rows.map((row) => row.category)))
  const results: GroupResult[] = []

  categories.forEach((category) => {
    const sorted = rows
      .filter((row) => row.category === category)
      .slice()
      .sort(compareGroup)

    let eligiblePlace = 0

    sorted.forEach((row, index) => {
      if (row.eligible) eligiblePlace += 1

      const previous = sorted[index - 1]
      const next = sorted[index + 1]

      const tiedWith = (other?: typeof row) =>
        Boolean(
          other &&
          row.eligible &&
          other.eligible &&
          row.category === other.category &&
          row.total === other.total &&
          row.tieBreakerScore === other.tieBreakerScore
        )

      results.push({
        ...row,
        place: row.eligible && eligiblePlace <= placements ? eligiblePlace : null,
        unresolvedTie: tiedWith(previous) || tiedWith(next),
      })
    })
  })

  return results
}

export function calculateTeamHigh(
  rows: AwardParticipant[],
  discipline: DisciplineKey,
): GroupResult[] {
  const teamSize = discipline === "trap" ? 5 : 3
  const grouped = new Map<string, AwardParticipant[]>()
  rows.filter((row) => row.complete && row.team !== "No team").forEach((row) => {
    const division = teamHighCategory(row.classCode)
    if (!division) return
    const key = `${division}|||${row.team}`
    grouped.set(key, [...(grouped.get(key) || []), row])
  })
  const results = Array.from(grouped.entries()).map(([key, participants]) => {
    const [category, label] = key.split("|||")
    const sorted = participants.slice().sort(compareParticipants)
    const members = sorted.slice(0, teamSize)
    return {
      label,
      category,
      members,
      total: members.reduce((sum, row) => sum + row.total, 0),
      eligible: participants.length >= teamSize,
      tieBreakerScore: sorted[teamSize]?.total ?? null,
    }
  })
  return finalizeGroups(results)
}

export function calculateStateTeams(rows: AwardParticipant[], discipline: DisciplineKey): GroupResult[] {
  return calculateTeamHigh(rows, discipline)
}

export function calculateSeriesTeams(rows: AwardParticipant[], discipline: DisciplineKey): GroupResult[] {
  return calculateTeamHigh(rows, discipline)
}

export type SeriesTeamShoot = {
  shootId: string
  shootName: string
  rows: AwardParticipant[]
}

export type OverallSeriesTeam = {
  category: string
  team: string
  points: number
  claysBroken: number
  shoots: number
  unresolvedTie: boolean
}

export function calculateOverallSeriesTeams(
  shoots: SeriesTeamShoot[],
  discipline: DisciplineKey,
): OverallSeriesTeam[] {
  const standings = new Map<string, Omit<OverallSeriesTeam, "unresolvedTie">>()

  shoots.forEach((shoot) => {
    calculateSeriesTeams(shoot.rows, discipline)
      .filter((result) => result.eligible)
      .forEach((result) => {
        const key = `${result.category}|||${result.label}`
        const current = standings.get(key) || {
          category: result.category,
          team: result.label,
          points: 0,
          claysBroken: 0,
          shoots: 0,
        }
        current.claysBroken += result.total
        current.shoots += 1
        if (result.place) current.points += 4 - result.place
        standings.set(key, current)
      })
  })

  const byCategory = new Map<string, Omit<OverallSeriesTeam, "unresolvedTie">[]>()
  standings.forEach((team) => {
    if (team.points <= 0) return
    byCategory.set(team.category, [...(byCategory.get(team.category) || []), team])
  })

  return ["VR", "JV", "IA / IE / R"].flatMap((category) => {
    const ranked = (byCategory.get(category) || []).sort((left, right) =>
      right.points - left.points ||
      right.claysBroken - left.claysBroken ||
      left.team.localeCompare(right.team),
    )

    return ranked.map((team, index) => ({
      ...team,
      unresolvedTie: Boolean(
        (ranked[index - 1] &&
          ranked[index - 1].points === team.points &&
          ranked[index - 1].claysBroken === team.claysBroken) ||
        (ranked[index + 1] &&
          ranked[index + 1].points === team.points &&
          ranked[index + 1].claysBroken === team.claysBroken),
      ),
    }))
  })
}

export function calculateSquads(rows: AwardParticipant[], _discipline: DisciplineKey): GroupResult[] {
  const grouped = new Map<string, AwardParticipant[]>()
  rows.filter((row) => row.complete && row.squad !== "Unassigned").forEach((row) => {
    const code = row.classCode.toUpperCase()
    const category = ["IA", "IE", "R"].includes(code) ? code : code
    const key = `${category}|||${row.squad}`
    grouped.set(key, [...(grouped.get(key) || []), row])
  })
  const results = Array.from(grouped.entries()).map(([key, participants]) => {
    const [category, label] = key.split("|||")
    const junior = ["IA", "IE", "R"].includes(category)
    const required = junior ? 2 : 3
    const maxCount = 3
    const sorted = participants.slice().sort(compareParticipants)
    const members = sorted.slice(0, maxCount)
    return {
      label,
      category,
      members,
      total: members.reduce((sum, row) => sum + row.total, 0),
      eligible: participants.length >= required && participants.length <= maxCount,
      tieBreakerScore: sorted[maxCount]?.total ?? null,
    }
  })
  return finalizeGroups(results)
}
