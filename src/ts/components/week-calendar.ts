import { addDays, formatDate, isoDate, monday } from "../lib/dates";
import { escapeHtml as esc } from "../lib/dom";
import { focusColor } from "../lib/focus";
import type { Lecture } from "../lib/types";

const pxToRem = (value: number) => `${value / 16}rem`;

/** Returns one course time for a date. */
function eventTime(course: Lecture, iso: string) {
  return course.event_times[iso] || { start: null, end: null };
}

/** Formats calendar metadata. */
function eventMeta(course: Lecture): string {
  return [
    course.instructors || "Professor not specified",
    course.rooms || "Room not specified",
  ].join(" · ");
}

/** Formats a known or incomplete time range. */
function timeLabel(time: { start: string | null; end: string | null }): string {
  if (!time.start) return "Time TBA";
  return time.end ? `${time.start}-${time.end}` : `${time.start}-?`;
}

/** Returns week bounds and the timed calendar grid. */
export function weekCalendar(courses: Lecture[], selected: Date) {
  const start = monday(selected);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const title = `${formatDate(isoDate(start))} - ${formatDate(isoDate(days[6]))}`;
  const headers = days
    .map(
      (day) =>
        `<div class="week-head"><strong>${new Intl.DateTimeFormat("en", { weekday: "short" }).format(day)}</strong><span>${formatDate(isoDate(day))}</span></div>`,
    )
    .join("");
  const untimed = days
    .map((day) => {
      const iso = isoDate(day);
      const events = courses.filter(
        (course) => course.dates.includes(iso) && !eventTime(course, iso).start,
      );
      return `<div class="all-day">${events.map((course) => `<a class="untimed" style="--type:${focusColor(course)}" href="#${course.id}" data-course-link><strong>${esc(course.title_en)}</strong><span>Time TBA</span><span class="week-meta">${esc(eventMeta(course))}</span></a>`).join("")}</div>`;
    })
    .join("");
  const axis = Array.from(
    { length: 14 },
    (_, index) =>
      `<span class="hour" style="top:${pxToRem(index * 60)}">${String(index + 8).padStart(2, "0")}:00</span>`,
  ).join("");
  const columns = days
    .map((day) => {
      const iso = isoDate(day);
      const events = courses.filter(
        (course) => course.dates.includes(iso) && eventTime(course, iso).start,
      );
      return `<div class="week-day">${events.map((course, index) => timedEvent(course, iso, index, events.length)).join("")}</div>`;
    })
    .join("");
  return {
    title,
    html: `<div class="week-corner"></div>${headers}<div class="all-day-label">TBA</div>${untimed}<div class="time-axis">${axis}</div>${columns}`,
  };
}

/** Positions one timed event within its day column. */
function timedEvent(
  course: Lecture,
  iso: string,
  index: number,
  count: number,
): string {
  const time = eventTime(course, iso);
  const [hour, minute] = time.start!.split(":").map(Number);
  const top = (hour - 8) * 60 + minute;
  let height = 90;
  if (time.end) {
    const [endHour, endMinute] = time.end.split(":").map(Number);
    height = Math.max(28, endHour * 60 + endMinute - (hour * 60 + minute));
  }
  const lane = `left:calc(${(index * 100) / count}% + ${pxToRem(3)});right:auto;width:calc(${100 / count}% - ${pxToRem(6)})`;
  return `<a class="week-event" style="--type:${focusColor(course)};top:${pxToRem(Math.max(0, top))};height:${pxToRem(height)};${lane}" href="#${course.id}" data-course-link><span>${esc(timeLabel(time))}</span><strong>${esc(course.title_en)}</strong><span class="week-meta">${esc(eventMeta(course))}</span></a>`;
}
