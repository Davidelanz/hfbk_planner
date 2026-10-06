import { addDays, isoDate } from "../lib/dates";
import { escapeHtml as esc } from "../lib/dom";
import { focusColor } from "../lib/focus";
import type { Lecture } from "../lib/types";

/** Returns one course time for a date. */
function eventTime(course: Lecture, iso: string) {
  return course.event_times[iso] || { start: null, end: null };
}

/** Formats a known or incomplete time range. */
function timeLabel(time: { start: string | null; end: string | null }): string {
  if (!time.start) return "Time TBA";
  return time.end ? `${time.start}-${time.end}` : `${time.start}-?`;
}

/** Renders a six-week month calendar. */
export function monthCalendar(courses: Lecture[], month: Date): string {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - ((first.getDay() + 6) % 7));
  let html = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((day) => `<div class="dow">${day}</div>`)
    .join("");

  for (let index = 0; index < 42; index += 1) {
    const day = addDays(start, index);
    const iso = isoDate(day);
    const events = courses.filter((course) => course.dates.includes(iso));
    const links = events
      .slice(0, 5)
      .map(
        (course) => `
          <a class="eventdot" style="--type:${focusColor(course)}" href="#${course.id}" data-course-link>
            <span class="event-time">${esc(timeLabel(eventTime(course, iso)))}</span>${esc(course.title_en)}
          </a>`,
      )
      .join("");
    const overflow =
      events.length > 5
        ? `<div class="eventdot">+${events.length - 5} more</div>`
        : "";
    html += `<div class="day ${day.getMonth() === monthIndex ? "" : "out"}"><div class="daynum">${day.getDate()}</div>${links}${overflow}</div>`;
  }
  return html;
}
