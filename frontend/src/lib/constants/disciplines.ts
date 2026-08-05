export const DISCIPLINE_VALUES = [
  "american_trap",
  "skeet",
  "sporting_clays",
  "bunker",
] as const

export type DisciplineValue = (typeof DISCIPLINE_VALUES)[number]

export const DISCIPLINE_OPTIONS: Array<{
  value: DisciplineValue
  label: string
}> = [
  { value: "american_trap", label: "Trap" },
  { value: "skeet", label: "Skeet" },
  { value: "sporting_clays", label: "Sporting Clays" },
  { value: "bunker", label: "Bunker" },
]

export const DISCIPLINE_FILTER_OPTIONS = [
  { value: "", label: "All disciplines" },
  ...DISCIPLINE_OPTIONS,
] as const

export function normalizeDiscipline(
  value: string | null | undefined,
  fallback: DisciplineValue = "sporting_clays",
): DisciplineValue {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

  switch (normalized) {
    case "trap":
    case "american_trap":
    case "americantrap":
      return "american_trap"
    case "skeet":
      return "skeet"
    case "sporting_clay":
    case "sporting_clays":
    case "sportingclays":
      return "sporting_clays"
    case "bunker":
    case "olympic_trap":
      return "bunker"
    default:
      return fallback
  }
}

export function getDisciplineLabel(
  value: string | null | undefined,
  fallback = "Not set",
): string {
  if (!value) return fallback

  const normalized = normalizeDiscipline(value)
  return (
    DISCIPLINE_OPTIONS.find((option) => option.value === normalized)
      ?.label ?? fallback
  )
}