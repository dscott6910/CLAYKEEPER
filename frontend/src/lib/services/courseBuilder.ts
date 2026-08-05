import { normalizeDiscipline } from "@/lib/constants/disciplines"
import { supabase } from "@/lib/supabase"

export type CourseSide = "East" | "West" | "Custom"

export type EventCourse = {
  id: string
  organization_id: string
  event_id: string
  name: string
  discipline: string
  course_side: CourseSide
  template_name: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type CourseStation = {
  id: string
  organization_id: string
  course_id: string
  station_number: number
  bird_count: number
  notes: string | null
  target_type: string | null
  display_order: number
}

export type CourseBuilderData = {
  event: {
    id: string
    organization_id: string
    name: string
    discipline: string | null
  }
  courses: EventCourse[]
  stations: CourseStation[]
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "A database error occurred.")
}

export async function loadCourseBuilderData(eventId: string): Promise<CourseBuilderData> {
  const eventResult = await supabase
    .from("events")
    .select("id,organization_id,name,discipline")
    .eq("id", eventId)
    .single()
  throwIfError(eventResult.error)
  const event = {
    ...(eventResult.data as CourseBuilderData["event"]),
    discipline: normalizeDiscipline(eventResult.data?.discipline),
  }

  const courseResult = await supabase
    .from("event_courses")
    .select("*")
    .eq("organization_id", event.organization_id)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
  throwIfError(courseResult.error)

  const courses = (courseResult.data ?? []) as EventCourse[]
  const courseIds = courses.map((course) => course.id)
  if (courseIds.length === 0) return { event, courses: [], stations: [] }

  const stationResult = await supabase
    .from("course_stations")
    .select("*")
    .in("course_id", courseIds)
    .order("display_order", { ascending: true })
  throwIfError(stationResult.error)

  return { event, courses, stations: (stationResult.data ?? []) as CourseStation[] }
}

export async function saveEventCourse(input: {
  organizationId: string
  eventId: string
  courseId?: string | null
  name: string
  discipline: string
  courseSide: CourseSide
  templateName?: string | null
  stations: Array<{ stationNumber: number; birdCount: number; notes: string; targetType: string }>
}) {
  const payload = {
    organization_id: input.organizationId,
    event_id: input.eventId,
    name: input.name.trim(),
    discipline: normalizeDiscipline(input.discipline),
    course_side: input.courseSide,
    template_name: input.templateName ?? null,
    active: true,
  }

  let courseId = input.courseId ?? null
  if (courseId) {
    const result = await supabase
      .from("event_courses")
      .update(payload)
      .eq("id", courseId)
      .eq("organization_id", input.organizationId)
    throwIfError(result.error)
  } else {
    const result = await supabase.from("event_courses").insert(payload).select("id").single()
    throwIfError(result.error)
    if (!result.data?.id) {
    throw new Error("The course was created, but no course ID was returned.")
}

courseId = result.data.id as string
  }

  const deleteResult = await supabase
    .from("course_stations")
    .delete()
    .eq("course_id", courseId)
    .eq("organization_id", input.organizationId)
  throwIfError(deleteResult.error)

  const rows = input.stations.map((station, index) => ({
    organization_id: input.organizationId,
    course_id: courseId,
    station_number: station.stationNumber,
    bird_count: station.birdCount,
    notes: station.notes.trim() || null,
    target_type: station.targetType.trim() || null,
    display_order: index + 1,
  }))
  const stationResult = await supabase.from("course_stations").insert(rows)
  throwIfError(stationResult.error)
  return courseId
}

export async function deleteEventCourse(organizationId: string, courseId: string) {
  const result = await supabase
    .from("event_courses")
    .delete()
    .eq("id", courseId)
    .eq("organization_id", organizationId)
  throwIfError(result.error)
}