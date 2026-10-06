import type { Course } from "./types";

const WEEKDAYS = new Set([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

/** Finds missing or malformed course fields without storing the result in JSON. */
export function courseInputIssues(course: Course): string[] {
  const issues: string[] = [];
  const requireText = (value: unknown, label: string) => {
    if (typeof value !== "string" || !value.trim()) {
      issues.push(`${label} is missing or invalid.`);
    }
  };

  requireText(course.classification?.subject, "Subject");
  requireText(course.classification?.type, "Course type");
  requireText(course.text?.en?.title, "English title");
  requireText(course.text?.de?.title, "German title");
  requireText(course.text?.en?.body, "English description");
  requireText(course.text?.de?.body, "German description");
  const machineTranslation = course.text?.machine_translation as unknown;
  if (
    machineTranslation != null &&
    machineTranslation !== "en" &&
    machineTranslation !== "de"
  ) {
    issues.push("Machine-translated text must be set to English or German.");
  }

  const hasEventsList = Array.isArray(course.calendar?.events);
  if (!hasEventsList) issues.push("Course dates must be stored as a list.");
  const events = hasEventsList ? (course.calendar.events as unknown[]) : [];
  const validDates = new Set<string>();
  events.forEach((event, index) => {
    if (!Array.isArray(event)) {
      issues.push(`Date ${index + 1} must be a date and optional time tuple.`);
      return;
    }
    if (event.length < 1 || event.length > 3) {
      issues.push(
        `Date ${index + 1} must contain a date and at most two times.`,
      );
    }

    const [date, start, end] = event;
    if (typeof date !== "string" || !isValidDate(date)) {
      issues.push(
        `Date ${index + 1} is missing or is not a valid YYYY-MM-DD date.`,
      );
      return;
    }
    if (validDates.has(date)) issues.push(`${date} is listed more than once.`);
    validDates.add(date);

    if (start != null && !isValidTime(start)) {
      issues.push(`Start time on ${date} must use HH:MM format.`);
    }
    if (end != null && !isValidTime(end)) {
      issues.push(`End time on ${date} must use HH:MM format.`);
    }
    if (isValidTime(start) && isValidTime(end) && end <= start) {
      issues.push(`End time on ${date} must be after the start time.`);
    }
  });

  const recurrence = course.calendar?.recurrence;
  const breakDates = course.calendar?.semester_break_excluded as unknown;
  if (
    breakDates !== undefined &&
    (!Array.isArray(breakDates) ||
      breakDates.some((date) => !isValidDate(date)))
  ) {
    issues.push("Semester break dates must be valid YYYY-MM-DD dates.");
  }
  if (!recurrence && hasEventsList && validDates.size === 0) {
    issues.push("Add at least one course date or a repeating schedule.");
  }
  if (
    breakDates !== undefined &&
    !recurrence &&
    (!Array.isArray(breakDates) || breakDates.length > 0)
  ) {
    issues.push("Semester break dates need a repeating schedule.");
  }
  if (recurrence) {
    if (!isValidDate(recurrence.start_date)) {
      issues.push("Repeating schedule start date is missing or invalid.");
    }
    if (!isValidDate(recurrence.end_date)) {
      issues.push("Repeating schedule end date is missing or invalid.");
    }
    if (
      isValidDate(recurrence.start_date) &&
      isValidDate(recurrence.end_date) &&
      recurrence.end_date < recurrence.start_date
    ) {
      issues.push("Repeating schedule end date is before its start date.");
    }
    if (!WEEKDAYS.has(recurrence.weekday)) {
      issues.push("Repeating schedule weekday is missing or invalid.");
    }
    if (
      recurrence.frequency !== "weekly" &&
      recurrence.frequency !== "biweekly"
    ) {
      issues.push("Repeating schedule frequency must be weekly or biweekly.");
    }
    if (
      !Number.isInteger(recurrence.interval_weeks) ||
      recurrence.interval_weeks < 1
    ) {
      issues.push(
        "Repeating schedule periodicity must be a positive whole number of weeks.",
      );
    }
    const start = recurrence.time?.start;
    const end = recurrence.time?.end;
    if (start != null && !isValidTime(start)) {
      issues.push("Repeating schedule start time must use HH:MM format.");
    }
    if (end != null && !isValidTime(end)) {
      issues.push("Repeating schedule end time must use HH:MM format.");
    }
    if (isValidTime(start) && isValidTime(end) && end <= start) {
      issues.push("Repeating schedule end time must be after its start time.");
    }
    if (validDates.size === 0) {
      issues.push("Repeating schedule has no valid generated course dates.");
    }
  }

  const emailValue = course.registration?.email as unknown;
  if (emailValue != null && typeof emailValue !== "string") {
    issues.push("Registration email must be text.");
  }
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push("Registration email is not a valid email address.");
  }

  return issues;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return false;
  }
  return true;
}
