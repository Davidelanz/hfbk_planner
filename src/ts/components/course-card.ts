import { formatDate } from "../lib/dates";
import { escapeHtml as esc } from "../lib/dom";
import { focus, focusColor } from "../lib/focus";
import type { Lecture } from "../lib/types";

/** Renders one collapsible bilingual course card. */
export function courseCard(
  course: Lecture,
  included: boolean,
  registered: boolean,
): string {
  const color = focusColor(course);
  const dates = course.dates.length
    ? course.dates.map(formatDate).join(" · ")
    : "Date not specified";
  const badge = (side: "en" | "de", label: string) =>
    course.machine_translation_side === side
      ? `<span class="badge">${label}</span>`
      : "";
  const facts = [
    course.instructors &&
      `<span class="fact">${esc(course.instructors)}</span>`,
    course.registration_email &&
      `<a class="fact" href="mailto:${esc(course.registration_email)}">Register: ${esc(course.registration_email)}</a>`,
    course.input_issues.length &&
      '<span class="fact needs">Needs confirmation</span>',
    course.user_confirmed_correction &&
      '<span class="fact">User-confirmed date correction</span>',
    course.recurrence &&
      course.semester_break_excluded.length &&
      '<span class="fact">Semester break excluded</span>',
  ]
    .filter(Boolean)
    .join("");

  return `
    <details class="lecture ${included ? "" : "excluded"}" id="${course.id}" style="--type:${color}">
      <summary>
        <div>
          <div class="sum-title">${esc(course.title_en || course.title_de)}</div>
          <div class="sum-meta">
            <span>${esc(focus(course))}</span><span>·</span><span>${esc(course.type)}</span>
            ${course.schedule ? `<span>·</span><span>${esc(course.schedule)}</span>` : ""}
            ${course.instructors ? `<span>·</span><span>${esc(course.instructors)}</span>` : ""}
          </div>
        </div>
        <div class="sum-actions">
          <label class="plan-toggle"><input type="checkbox" data-course-toggle="${course.id}" ${included ? "checked" : ""}> In plan</label>
          <label class="plan-toggle"><input type="checkbox" data-course-registered="${course.id}" ${registered ? "checked" : ""}> Registered</label>
          <div class="chev">+</div>
        </div>
      </summary>
      <div class="lecture-body">
        <div class="columns">
          <section class="lang"><h3>English ${badge("en", "Machine translated")}</h3><strong>${esc(course.title_en)}</strong><p>${esc(course.body_en)}</p></section>
          <section class="lang"><h3>Deutsch ${badge("de", "Maschinell übersetzt")}</h3><strong>${esc(course.title_de)}</strong><p>${esc(course.body_de)}</p></section>
        </div>
        <div class="facts">
          <span class="type-chip" style="background:${color}18;color:${color}">${esc(focus(course))}</span>
          <span class="fact">${esc(course.type)}</span><span class="fact">${esc(dates)}</span>${facts}
        </div>
        <div class="course-edit-action">
          <button class="btn" type="button" data-edit-course="${esc(course.id)}">Edit course</button>
        </div>
      </div>
    </details>`;
}
