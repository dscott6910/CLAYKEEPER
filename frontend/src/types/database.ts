export type EventStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "archived"

export type ShootDiscipline =
  | "american_trap"
  | "skeet"
  | "sporting_clays"
  | "bunker"

export type EventRecord = {
  id: string
  organization_id: string
  name: string
  description: string | null
  series_name: string | null
  sponsor_name: string | null
  start_date: string | null
  end_date: string | null
  status: EventStatus
}

export type ShootRecord = {
  id: string
  organization_id: string
  event_id: string
  location_id: string | null
  name: string
  discipline: ShootDiscipline
  competition_type: string | null
  shoot_date: string
  start_time: string | null
  sponsor_name: string | null
  entry_fee: number
  organization_fee: number
  targets_per_round: number
  number_of_rounds: number
  squad_size: number | null
  registration_capacity: number | null
  allow_waitlist: boolean
  allow_online_registration: boolean
  allow_score_entry: boolean
  status: EventStatus
  notes: string | null
  active: boolean
}

export type ShootPayload = Omit<ShootRecord, "id">

export type LocationRecord = { id: string; name: string }

export type RegistrationRecord = {
  id: string
  athlete_id: string
  team_id: string | null
  class_id: string | null
  registration_number: string | null
  status: string
  payment_status: string
  checked_in: boolean
  amount_paid: number
}

export type AthleteRecord = {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  cyssa_number: string | null
}

export type TeamRecord = { id: string; name: string }

export type ClassRecord = {
  id: string
  code: string
  display_name: string
}

export type EventWorkspaceData = {
  event: EventRecord
  shoots: ShootRecord[]
  locations: LocationRecord[]
  registrations: RegistrationRecord[]
  athletes: AthleteRecord[]
  teams: TeamRecord[]
  classes: ClassRecord[]
}
