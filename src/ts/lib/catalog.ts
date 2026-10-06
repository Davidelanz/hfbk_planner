import type { Course, CoursePayload, EventTuple, Lecture } from "./types";
import { courseInputIssues } from "./course-input-checks";
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
    const rawEvents: unknown = course.calendar?.events;
    const events: EventTuple[] = Array.isArray(rawEvents)
      ? rawEvents.flatMap((event): EventTuple[] => {
          if (!Array.isArray(event) || !isValidDate(event[0])) return [];
          return [
            [
              event[0],
              isValidTime(event[1]) ? event[1] : null,
              isValidTime(event[2]) ? event[2] : null,
            ],
          ];
        })
      : [];
    const titleEn = stringValue(course.text?.en?.title);
    const titleDe = stringValue(course.text?.de?.title);
    const machineTranslation = course.text?.machine_translation;
    return {
      id: course.id,
      page: course.source?.pdf_page,
      subject: normalizeSubject(stringValue(course.classification?.subject)),
      type: normalizeCourseType(stringValue(course.classification?.type)),
      title_en: titleEn,
      body_en: stringValue(course.text?.en?.body),
      title_de: titleDe,
      body_de: stringValue(course.text?.de?.body),
      machine_translation_side:
        machineTranslation === "en" || machineTranslation === "de"
          ? machineTranslation
          : null,
      instructors: stringValue(course.details?.instructors),
      rooms: stringValue(course.details?.room),
      schedule: scheduleLabel({
        ...course,
        calendar: { ...course.calendar, events },
      }),
      dates: events.map((event) => event[0]),
      event_times: Object.fromEntries(
        events.map((event) => [
          event[0],
          { start: event[1] || null, end: event[2] || null },
        ]),
      ),
      input_issues: courseInputIssues(course),
      recurrence: course.calendar?.recurrence || null,
      semester_break_excluded: course.calendar?.recurrence
        ? course.calendar.semester_break_excluded || []
        : [],
      registration_email: stringValue(course.registration?.email),
      registered_default: !!course.registration?.registered,
      plan_default: course.plan !== false,
      user_confirmed_correction: !!course.source?.user_confirmed_correction,
    };
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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
