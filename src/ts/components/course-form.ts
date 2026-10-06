import { escapeHtml as esc } from "../lib/dom";
import type { Course, EventTuple, Recurrence } from "../lib/types";
import { COURSE_TYPES, SUBJECTS } from "../lib/taxonomy";

export const DEFAULT_SUBJECTS = [...SUBJECTS];
export const DEFAULT_TYPES = [...COURSE_TYPES];

/** Builds one date and time row. */
export function eventRow(date = "", start = "", end = ""): string {
  return `<div class="event-row">
    <label>Date<input type="date" name="event-date" value="${esc(date)}"></label>
    <label>Starts<input type="time" name="event-start" value="${esc(start)}"></label>
    <label>Ends<input type="time" name="event-end" value="${esc(end)}"></label>
    <button class="mini remove-event" type="button" aria-label="Remove this date">Remove</button>
  </div>`;
}

/** Fills a select with sorted unique options. */
export function fillSelect(
  select: HTMLSelectElement,
  values: string[],
  defaults: string[],
): void {
  const selected = select.value;
  const options = [...new Set([...values, ...defaults])].sort();
  select.innerHTML = [
    '<option value="">Choose an option</option>',
    ...options.map(
      (value) => `<option value="${esc(value)}">${esc(value)}</option>`,
    ),
  ].join("");
  if (options.includes(selected)) select.value = selected;
}

/** Populates the guided form when editing an existing course. */
export function populateCourseForm(
  form: HTMLFormElement,
  course: Course,
): void {
  const setValue = (name: string, value: string) => {
    const field = form.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`[name="${name}"]`);
    if (field) field.value = value;
  };
  const recurrence = course.calendar.recurrence;

  setValue("title-en", course.text.en.title);
  setValue("title-de", course.text.de.title);
  setValue("subject", course.classification.subject);
  setValue("type", course.classification.type);
  setValue("instructors", course.details.instructors || "");
  setValue("room", course.details.room || "");
  setValue("body-en", course.text.en.body);
  setValue("body-de", course.text.de.body);
  setValue("machine-translation", course.text.machine_translation || "");
  setValue("registration-email", course.registration.email || "");
  setValue("recurrence-start-date", "");
  setValue("recurrence-end-date", "");
  setValue("recurrence-weekday", "");
  setValue("recurrence-time-start", "");
  setValue("recurrence-time-end", "");
  setValue("recurrence-interval-weeks", "1");
  setValue("recurrence-break-dates", "");
  form.querySelector<HTMLInputElement>('[name="plan"]')!.checked =
    course.plan !== false;
  form.querySelector<HTMLInputElement>('[name="registered"]')!.checked =
    !!course.registration.registered;
  form.querySelector<HTMLInputElement>(
    `input[name="date-mode"][value="${recurrence ? "repeating" : "exact"}"]`,
  )!.checked = true;

  const rows = form.querySelector<HTMLDivElement>("#eventRows")!;
  rows.innerHTML = course.calendar.events.length
    ? course.calendar.events
        .map(([date, start, end]) => eventRow(date, start || "", end || ""))
        .join("")
    : eventRow();

  if (recurrence) {
    const interval = recurrence.interval_weeks || 1;
    const periodicity = form.querySelector<HTMLSelectElement>(
      '[name="recurrence-interval-weeks"]',
    )!;
    if (
      ![...periodicity.options].some((option) => option.value === `${interval}`)
    ) {
      periodicity.add(new Option(`Every ${interval} weeks`, `${interval}`));
    }
    setValue("recurrence-start-date", recurrence.start_date);
    setValue("recurrence-end-date", recurrence.end_date);
    setValue("recurrence-weekday", recurrence.weekday);
    setValue("recurrence-time-start", recurrence.time?.start || "");
    setValue("recurrence-time-end", recurrence.time?.end || "");
    setValue("recurrence-interval-weeks", `${interval}`);
    setValue(
      "recurrence-break-dates",
      (course.calendar.semester_break_excluded || []).join(", "),
    );
  }
}

/** Converts guided form fields to the portable course schema. */
export function courseFromForm(
  form: HTMLFormElement,
  existingCourse?: Course,
): Course {
  const data = new FormData(form);
  const value = (name: string) => String(data.get(name) || "").trim();
  const titleEn = value("title-en");
  const titleDe = value("title-de");
  const bodyEn = value("body-en");
  const bodyDe = value("body-de");
  const dateMode =
    form.querySelector<HTMLInputElement>('input[name="date-mode"]:checked')
      ?.value ?? "exact";
  const recurring = dateMode === "repeating" ? readRecurrence(value) : null;
  const events = recurring ? recurring.events : readEvents(form);
  const needsInput: string[] = [];

  if (!titleDe) needsInput.push("text.de.title");
  if (!bodyEn) needsInput.push("text.en.body");
  if (!bodyDe) needsInput.push("text.de.body");
  if (dateMode !== "repeating" && !events.length)
    needsInput.push("calendar.events");

  const translation = value("machine-translation");
  const slug = titleEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const calendar: Course["calendar"] = { events };
  if (recurring) {
    calendar.recurrence = recurring.recurrence;
    if (recurring.semesterBreakExcluded.length) {
      calendar.semester_break_excluded = recurring.semesterBreakExcluded;
    }
  }
  if (needsInput.length) calendar.needs_input = needsInput;

  return {
    id:
      existingCourse?.id ||
      `${slug || "course"}-${crypto.randomUUID().slice(0, 8)}`,
    plan: data.has("plan"),
    classification: {
      subject: value("subject"),
      type: value("type"),
    },
    text: {
      en: { title: titleEn, body: bodyEn },
      de: { title: titleDe, body: bodyDe },
      ...(translation === "en" || translation === "de"
        ? { machine_translation: translation }
        : {}),
    },
    details: {
      instructors: value("instructors"),
      room: value("room"),
    },
    registration: {
      registered: data.has("registered"),
      email: value("registration-email"),
    },
    calendar,
    ...(existingCourse?.source ? { source: existingCourse.source } : {}),
  };
}

/** Reads a repeating course definition if the user chose that mode. */
function readRecurrence(value: (name: string) => string): {
  recurrence: Recurrence;
  semesterBreakExcluded: string[];
  events: EventTuple[];
} {
  const weekday = value("recurrence-weekday");
  const startDate = value("recurrence-start-date");
  const endDate = value("recurrence-end-date");
  const interval = Number(value("recurrence-interval-weeks") || "1");
  const semesterBreakExcluded = readBreakDates(value("recurrence-break-dates"));
  const timeStart = value("recurrence-time-start");
  const timeEnd = value("recurrence-time-end");

  if (!weekday || !startDate || !endDate) {
    throw new Error(
      "Repeating dates need a start date, end date, weekday, and periodicity.",
    );
  }
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("The repetition interval must be a whole number of weeks.");
  }
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new Error(
      "Enter valid start and end dates for the repeating course.",
    );
  }
  if (endDate < startDate) {
    throw new Error("The recurrence end date must be after the start date.");
  }
  if (timeStart && timeEnd && timeEnd <= timeStart) {
    throw new Error("The recurrence end time must be after the start time.");
  }

  const weekdays: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const weekdayIndex = weekdays[weekday];
  if (weekdayIndex === undefined) {
    throw new Error("Choose a valid weekday for the repeating course.");
  }
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const endTimestamp = new Date(`${endDate}T00:00:00.000Z`).getTime();
  while (current.getUTCDay() !== weekdayIndex) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  const events: EventTuple[] = [];
  while (current.getTime() <= endTimestamp) {
    const date = current.toISOString().slice(0, 10);
    if (!semesterBreakExcluded.includes(date)) {
      events.push([date, timeStart || null, timeEnd || null]);
    }
    current.setUTCDate(current.getUTCDate() + interval * 7);
  }
  if (!events.length) {
    throw new Error(
      "This repeating schedule has no dates. Check the date range and break dates.",
    );
  }

  return {
    recurrence: {
      frequency: interval === 2 ? "biweekly" : "weekly",
      interval_weeks: interval,
      weekday,
      start_date: startDate,
      end_date: endDate,
      ...(timeStart || timeEnd
        ? {
            time: {
              start: timeStart || null,
              end: timeEnd || null,
            },
          }
        : {}),
    },
    semesterBreakExcluded,
    events,
  };
}

/** Parses ISO break dates supplied as a comma-separated list. */
function readBreakDates(raw: string): string[] {
  const dates = raw
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((date) => {
      if (!isIsoDate(date)) {
        throw new Error(`Break date "${date}" is not a valid ISO date.`);
      }
      return true;
    })
    .sort();

  return [...new Set(dates)];
}

/** Checks the format and calendar validity of an ISO date. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Reads complete and partial date rows. */
function readEvents(form: HTMLFormElement): EventTuple[] {
  return [...form.querySelectorAll<HTMLElement>(".event-row")]
    .map((row): EventTuple | null => {
      const date =
        row.querySelector<HTMLInputElement>("[name=event-date]")!.value;
      if (!date) return null;
      const start =
        row.querySelector<HTMLInputElement>("[name=event-start]")!.value;
      const end =
        row.querySelector<HTMLInputElement>("[name=event-end]")!.value;
      if (start && end && end <= start) {
        throw new Error(
          `The end time on ${date} must be after the start time.`,
        );
      }
      return [date, start || null, end || null];
    })
    .filter((event): event is EventTuple => event !== null)
    .sort(([left], [right]) => left.localeCompare(right));
}
