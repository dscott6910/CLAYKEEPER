import { supabase } from "@/lib/supabase"
import type { ShootPayload, ShootRecord } from "@/types/database"

export async function createShoot(payload: ShootPayload) {
  const result = await supabase.from("shoots").insert(payload)
  if (result.error) throw result.error
}

export async function updateShoot(id: string, payload: ShootPayload) {
  const result = await supabase.from("shoots").update(payload).eq("id", id)
  if (result.error) throw result.error
}

export async function duplicateShootRecord(shoot: ShootRecord) {
  const payload: ShootPayload = {
    organization_id: shoot.organization_id,
    event_id: shoot.event_id,
    location_id: shoot.location_id,
    name: `${shoot.name} Copy`,
    discipline: shoot.discipline,
    competition_type: shoot.competition_type,
    shoot_date: shoot.shoot_date,
    start_time: shoot.start_time,
    sponsor_name: shoot.sponsor_name,
    entry_fee: shoot.entry_fee,
    organization_fee: shoot.organization_fee,
    targets_per_round: shoot.targets_per_round,
    number_of_rounds: shoot.number_of_rounds,
    squad_size: shoot.squad_size,
    registration_capacity: shoot.registration_capacity,
    allow_waitlist: shoot.allow_waitlist,
    allow_online_registration: shoot.allow_online_registration,
    allow_score_entry: shoot.allow_score_entry,
    status: "draft",
    notes: shoot.notes,
    active: shoot.active,
  }
  await createShoot(payload)
}

export async function deleteShootRecord(id: string) {
  const result = await supabase.from("shoots").delete().eq("id", id)
  if (result.error) throw result.error
}
