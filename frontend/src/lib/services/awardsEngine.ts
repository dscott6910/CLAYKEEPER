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
  const sorted = rows.filter((row) => row.complete).slice().sort(compareParticipants)
  return sorted.slice(0, limit).map((row, index) => ({
    ...row,
    place: index + 1,
    unresolvedTie: Boolean(
      (sorted[index - 1] && sameCompetitiveScore(row, sorted[index - 1])) ||
      (sorted[index + 1] && sameCompetitiveScore(row, sorted[index + 1])),
    ),
  }))
}

export function classAwardGroups(rows: AwardParticipant[], meetType: MeetType) {
  return CYSSA_CLASSES.map((classCode) => ({
    classCode,
    rows: rankIndividuals(rows.filter((row) => row.classCode.toUpperCase() === classCode), individualPlacementCount(meetType, classCode)),
  }))
}

function teamCategory(classCode: string) {
  const code = classCode.toUpperCase()
  if (["VR", "YA"].includes(code)) return "Varsity High School / Gun Club"
  if (code === "JV") return "Junior Varsity High School / Gun Club"
  return "IA / IE / R Junior School / Junior Gun Club"
}

function compareGroup(a: Omit<GroupResult, "place" | "unresolvedTie">, b: Omit<GroupResult, "place" | "unresolvedTie">) {
  if (b.total !== a.total) return b.total - a.total
  const aTie = a.tieBreakerScore ?? -1
  const bTie = b.tieBreakerScore ?? -1
  if (bTie !== aTie) return bTie - aTie
  return a.label.localeCompare(b.label)
}

function finalizeGroups(rows: Array<Omit<GroupResult, "place" | "unresolvedTie">>, placements = 3): GroupResult[] {
  const sorted = rows.slice().sort(compareGroup)
  let eligiblePlace = 0
  return sorted.map((row, index) => {
    if (row.eligible) eligiblePlace += 1
    const previous = sorted[index - 1]
    const next = sorted[index + 1]
    const tiedWith = (other?: typeof row) => Boolean(other && row.eligible && other.eligible && row.total === other.total && row.tieBreakerScore === other.tieBreakerScore)
    return {
      ...row,
      place: row.eligible && eligiblePlace <= placements ? eligiblePlace : null,
      unresolvedTie: tiedWith(previous) || tiedWith(next),
    }
  })
}

export function calculateStateTeams(rows: AwardParticipant[], discipline: DisciplineKey): GroupResult[] {
  const teamSize = discipline === "trap" ? 5 : 3
  const grouped = new Map<string, AwardParticipant[]>()
  rows.filter((row) => row.complete && row.team !== "No team").forEach((row) => {
    const key = `${teamCategory(row.classCode)}|||${row.team}`
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

export type SeriesShootTeam = { shootId: string; shootName: string; rows: AwardParticipant[] }
export type SeriesTeamStanding = {
  category: string
  team: string
  points: number
  shootPoints: Array<{ shootId: string; shootName: string; points: number; place: number | null; score: number }>
  unresolvedTie: boolean
}

export function calculateSeriesTeamPoints(shoots: SeriesShootTeam[], discipline: DisciplineKey): SeriesTeamStanding[] {
  const scoreSize = discipline === "trap" ? 5 : 3
  const standings = new Map<string, SeriesTeamStanding>()
  for (const shoot of shoots) {
    const grouped = new Map<string, AwardParticipant[]>()
    shoot.rows.filter((row) => row.complete && row.team !== "No team").forEach((row) => {
      const category = teamCategory(row.classCode)
      const key = `${category}|||${row.team}`
      grouped.set(key, [...(grouped.get(key) || []), row])
    })
    const ranked = Array.from(grouped.entries()).map(([key, participants]) => {
      const [category, team] = key.split("|||")
      const members = participants.slice().sort(compareParticipants).slice(0, scoreSize)
      return { key, category, team, score: members.reduce((sum, row) => sum + row.total, 0), eligible: participants.length >= scoreSize }
    }).filter((row) => row.eligible).sort((a, b) => b.score - a.score || a.team.localeCompare(b.team))

    ranked.forEach((row, index) => {
      const previous = ranked[index - 1]
      let place = index + 1
      if (previous && previous.score === row.score) place = index
      const points = place === 1 ? 3 : place === 2 ? 2 : place === 3 ? 1 : 0
      const current = standings.get(row.key) || { category: row.category, team: row.team, points: 0, shootPoints: [], unresolvedTie: false }
      current.points += points
      current.shootPoints.push({ shootId: shoot.shootId, shootName: shoot.shootName, points, place: points ? place : null, score: row.score })
      standings.set(row.key, current)
    })
  }
  const rows = Array.from(standings.values()).sort((a, b) => b.points - a.points || a.team.localeCompare(b.team))
  return rows.map((row, index) => ({ ...row, unresolvedTie: Boolean((rows[index - 1] && rows[index - 1].points === row.points && rows[index - 1].category === row.category) || (rows[index + 1] && rows[index + 1].points === row.points && rows[index + 1].category === row.category)) }))
}
