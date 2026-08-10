export type OrganizationRole =
  | "owner"
  | "admin"
  | "coach"
  | "scorekeeper"
  | "member"

export type OrganizationCapability =
  | "admin"
  | "manageParticipants"
  | "manageEvents"
  | "manageRegistration"
  | "managePayments"
  | "manageSeasons"
  | "manageImports"
  | "manageCoachPortal"
  | "operateEvents"
  | "score"
  | "deleteScores"
  | "managePublicPortal"

const ADMIN_ROLES: OrganizationRole[] = ["owner", "admin"]

const SCORING_ROLES: OrganizationRole[] = [
  "owner",
  "admin",
  "coach",
  "scorekeeper",
]

const COACH_ROLES: OrganizationRole[] = [
  "owner",
  "admin",
  "coach",
]

export function normalizeOrganizationRole(
  role: string | null | undefined,
): OrganizationRole {
  switch (role) {
    case "owner":
    case "admin":
    case "coach":
    case "scorekeeper":
    case "member":
      return role
    default:
      return "member"
  }
}

export function hasCapability(
  role: OrganizationRole | string | null | undefined,
  capability: OrganizationCapability,
): boolean {
  const normalizedRole = normalizeOrganizationRole(role)

  switch (capability) {
    case "admin":
    case "manageParticipants":
    case "manageEvents":
    case "manageRegistration":
    case "managePayments":
    case "manageSeasons":
    case "manageImports":
      return ADMIN_ROLES.includes(normalizedRole)

    case "score":
      return SCORING_ROLES.includes(normalizedRole)

    case "deleteScores":
      return ADMIN_ROLES.includes(normalizedRole)

    case "manageCoachPortal":
    case "operateEvents":
    case "managePublicPortal":
      return COACH_ROLES.includes(normalizedRole)

    default:
      return false
  }
}
