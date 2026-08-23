export type YouthRegistrationSession = {
  id: string
  name: string
  description: string
  dates: string
  location: string
}

export const YOUTH_SEASON_REGISTRATION_FEE = 35

export const YOUTH_REGISTRATION_SESSIONS: YouthRegistrationSession[] = [
  {
    id: "bunker",
    name: "2026 - 2027: Bunker",
    description: "Olympic bunker trap season registration.",
    dates: "08/01/2026 - 06/13/2027",
    location: "California Youth Shooting Sports Association",
  },
  {
    id: "skeet",
    name: "2026 - 2027: Skeet",
    description: "Youth skeet season registration.",
    dates: "08/01/2026 - 06/13/2027",
    location: "California Youth Shooting Sports Association",
  },
  {
    id: "sporting-clays",
    name: "2026 - 2027: Sporting Clays",
    description: "Sporting clays season registration.",
    dates: "08/01/2026 - 06/13/2027",
    location: "California Youth Shooting Sports Association",
  },
  {
    id: "trap",
    name: "2026 - 2027: Trap",
    description: "American trap season registration.",
    dates: "08/01/2026 - 06/13/2027",
    location: "California Youth Shooting Sports Association",
  },
]

export function youthRegistrationSessionsByIds(ids: string[]) {
  const selectedIds = new Set(ids)

  return YOUTH_REGISTRATION_SESSIONS.filter((session) =>
    selectedIds.has(session.id),
  )
}
