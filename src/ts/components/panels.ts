import { formatDate, minutes } from "../lib/dates";
import { escapeHtml as esc } from "../lib/dom";
import type { Lecture } from "../lib/types";

/** Renders courses with exact missing fields. */
export function questionsPanel(courses: Lecture[]): string {
  const items = courses.filter((course) => course.needs_input.length);
  if (!items.length)
    return '<div class="empty"><strong>No missing fields in this selection.</strong></div>';
  return items
    .map(
      (course) =>
        `<div class="question"><div><strong>${esc(course.title_en || course.title_de)}</strong><br><span>${esc(course.subject)} · PDF p. ${course.page ?? "?"}</span><ul class="missing-list">${course.needs_input.map((field) => `<li>${esc(field)}</li>`).join("")}</ul></div><a href="#${course.id}" data-course-link>Open course</a></div>`,
    )
    .join("");
}

/** Renders courses ranked by timed overlaps. */
export function conflictsPanel(courses: Lecture[]): string {
  const rows = courses.map((course) => ({
    course,
    partners: [] as { course: Lecture; dates: string[] }[],
  }));
  for (let left = 0; left < courses.length; left += 1) {
    for (let right = left + 1; right < courses.length; right += 1) {
      const dates = conflictDates(courses[left], courses[right]);
      if (!dates.length) continue;
      rows[left].partners.push({ course: courses[right], dates });
      rows[right].partners.push({ course: courses[left], dates });
    }
  }
  rows.sort((a, b) => score(b) - score(a));
  const active = rows.filter((row) => row.partners.length);
  if (!active.length)
    return '<div class="empty"><strong>No timed conflicts among included courses.</strong></div>';
  return active
    .map(
      (row) =>
        `<div class="conflict-row"><strong>${esc(row.course.title_en)}</strong><span class="conflict-score">${score(row)} overlapping session${score(row) === 1 ? "" : "s"}</span><p class="conflict-partners">${row.partners.map((partner) => `${esc(partner.course.title_en)} (${partner.dates.map(formatDate).join(", ")})`).join(" · ")}</p></div>`,
    )
    .join("");
}

/** Counts overlapping sessions in one conflict row. */
function score(row: { partners: { dates: string[] }[] }): number {
  return row.partners.reduce(
    (total, partner) => total + partner.dates.length,
    0,
  );
}

/** Finds dates where two course times overlap. */
function conflictDates(a: Lecture, b: Lecture): string[] {
  return a.dates.filter((date) => {
    if (!b.dates.includes(date)) return false;
    const first = a.event_times[date];
    const second = b.event_times[date];
    if (!first?.start || !second?.start) return false;
    const firstStart = minutes(first.start)!;
    const secondStart = minutes(second.start)!;
    const firstEnd = first.end ? minutes(first.end)! : firstStart + 90;
    const secondEnd = second.end ? minutes(second.end)! : secondStart + 90;
    return firstStart < secondEnd && secondStart < firstEnd;
  });
}
