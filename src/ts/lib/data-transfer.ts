import type { Course, CoursePayload } from "./types";
import { normalizeCourseTaxonomy } from "./taxonomy";

/** Validates the minimum portable catalogue contract. */
export function validatePayload(value: unknown): Course[] {
  const payload = value as CoursePayload | Course[];
  const courses = Array.isArray(payload) ? payload : payload?.courses;
  if (!Array.isArray(courses))
    throw new Error("The file needs a courses list.");

  const ids = new Set<string>();
  courses.forEach((course, index) => {
    if (!course?.id || ids.has(course.id))
      throw new Error(`Course ${index + 1} needs a unique id.`);
    ids.add(course.id);
    if (!course.classification?.subject || !course.classification?.type) {
      throw new Error(`${course.id}: subject and type are required.`);
    }
    if (!course.text?.en || !course.text?.de) {
      throw new Error(
        `${course.id}: English and German text objects are required.`,
      );
    }
    if (!Array.isArray(course.calendar?.events)) {
      throw new Error(`${course.id}: calendar.events must be a list.`);
    }
    if (
      course.calendar.semester_break_excluded &&
      !course.calendar.recurrence
    ) {
      throw new Error(
        `${course.id}: semester_break_excluded needs recurrence.`,
      );
    }
  });
  return courses.map(normalizeCourseTaxonomy);
}

/** Downloads catalogue data with current user choices. */
export function downloadCatalog(
  courses: Course[],
  included: Set<string>,
  registered: Set<string>,
): void {
  const output = structuredClone(courses);
  output.forEach((course) => {
    course.plan = included.has(course.id);
    course.registration ||= { registered: false, email: "" };
    course.registration.registered = registered.has(course.id);
  });

  const blob = new Blob(
    [JSON.stringify({ schema_version: 1, courses: output }, null, 2) + "\n"],
    {
      type: "application/json",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "data.json";
  link.click();
  URL.revokeObjectURL(url);
}
