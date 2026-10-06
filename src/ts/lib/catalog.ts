import type { Course, CoursePayload, Lecture } from "./types";
import {
  normalizeCourseTaxonomy,
  normalizeCourseType,
  normalizeSubject,
} from "./taxonomy";

/** Builds the compact schedule shown on collapsed cards. */
function scheduleLabel(course: Course): string {
  const recurrence = course.calendar.recurrence;
  if (recurrence) {
    const start = recurrence.time?.start;
    const end = recurrence.time?.end;
    const time = start ? (end ? `${start}-${end}` : `${start}-?`) : "Time TBA";
    const interval =
      recurrence.interval_weeks ||
      (recurrence.frequency === "biweekly" ? 2 : 1);
    const frequency =
      interval === 1
        ? "Weekly"
        : interval === 2
          ? "Every other week"
          : `Every ${interval} weeks`;
    return `${frequency} · ${recurrence.weekday} · ${time}`;
  }
  const events = course.calendar.events;
  if (events.length === 1) {
    return `${events[0][0]} · ${events[0][1] || "Time TBA"}${events[0][2] ? `-${events[0][2]}` : ""}`;
  }
  return events.length ? `${events.length} scheduled sessions` : "Date TBA";
}

/** Derives render-ready fields from canonical course data. */
export function hydrate(data: Course[]): Lecture[] {
  return data.map((course) => {
    const events = course.calendar.events || [];
    return {
      id: course.id,
      page: course.source?.pdf_page,
      subject: normalizeSubject(course.classification?.subject || ""),
      type: normalizeCourseType(course.classification?.type || ""),
      title_en: course.text?.en?.title || "",
      body_en: course.text?.en?.body || "",
      title_de: course.text?.de?.title || "",
      body_de: course.text?.de?.body || "",
      machine_translation_side: course.text?.machine_translation || null,
      instructors: course.details?.instructors || "",
      rooms: course.details?.room || "",
      schedule: scheduleLabel(course),
      dates: events.map((event) => event[0]),
      event_times: Object.fromEntries(
        events.map((event) => [
          event[0],
          { start: event[1] || null, end: event[2] || null },
        ]),
      ),
      needs_input: course.calendar?.needs_input || [],
      recurrence: course.calendar?.recurrence || null,
      semester_break_excluded: course.calendar?.recurrence
        ? course.calendar.semester_break_excluded || []
        : [],
      registration_email: course.registration?.email || "",
      registered_default: !!course.registration?.registered,
      plan_default: course.plan !== false,
      user_confirmed_correction: !!course.source?.user_confirmed_correction,
    };
  });
}

/** Loads local data or returns an empty upload shell. */
export async function loadCatalog(url = "./data.json"): Promise<CoursePayload> {
  const response = await fetch(url);
  if (response.status === 404) return { schema_version: 1, courses: [] };
  if (!response.ok)
    throw new Error(`Could not load data.json (${response.status})`);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return { schema_version: 1, courses: [] };
  }
  const value = await response.json();
  const payload = Array.isArray(value)
    ? { schema_version: 1, courses: value }
    : value;
  return {
    ...payload,
    courses: payload.courses.map(normalizeCourseTaxonomy),
  };
}
