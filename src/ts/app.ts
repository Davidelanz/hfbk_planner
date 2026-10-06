import { courseCard } from "./components/course-card";
import { monthCalendar } from "./components/month-calendar";
import { conflictsPanel, questionsPanel } from "./components/panels";
import { weekCalendar } from "./components/week-calendar";
import { loadCatalog } from "./lib/catalog";
import { validatePayload, downloadCatalog } from "./lib/data-transfer";
import { addDays } from "./lib/dates";
import { $, $$, escapeHtml as esc } from "./lib/dom";
import { FOCUS_COLORS, focus } from "./lib/focus";
import { PlannerState } from "./lib/state";
import { readStored, writeStored } from "./lib/storage";

interface SavedList {
  name: string;
  subjects: string[];
  types: string[];
  query: string;
  included: string[];
  registered: string[];
}

const payload = await loadCatalog();
const state = new PlannerState(payload.courses);

/** Renders every view from current state. */
function render(): void {
  renderFilters();
  renderCourses();
  renderMonth();
  renderWeek();
  renderPanels();
  renderSavedLists();
}

/** Renders subject, type, and color controls. */
function renderFilters(): void {
  const subjects = [...new Set(state.lectures.map((course) => course.subject))];
  const types = [...new Set(state.lectures.map((course) => course.type))];
  $("#subjects").innerHTML = subjects
    .map((subject) =>
      filterControl("subject", subject, state.subjects.has(subject)),
    )
    .join("");
  $("#types").innerHTML = types
    .map((type) => filterControl("type", type, state.types.has(type)))
    .join("");
  $("#legend").innerHTML = [...new Set(state.lectures.map(focus))]
    .map(
      (group) =>
        `<span style="--legend:${FOCUS_COLORS[group]}">${esc(group)}</span>`,
    )
    .join("");
}

/** Builds one checked filter control. */
function filterControl(kind: string, value: string, checked: boolean): string {
  return `<label class="check"><input type="checkbox" value="${esc(value)}" data-kind="${kind}" ${checked ? "checked" : ""}><span>${esc(value)}</span></label>`;
}

/** Renders course cards and the result count. */
function renderCourses(): void {
  const courses = state.filtered();
  const included = courses.filter((course) =>
    state.included.has(course.id),
  ).length;
  $("#count").textContent = `${included} in plan · ${courses.length} courses`;
  $("#lectureList").innerHTML = courses.length
    ? courses
        .map((course) =>
          courseCard(
            course,
            state.included.has(course.id),
            state.registered.has(course.id),
          ),
        )
        .join("")
    : '<div class="empty"><h2>No matching courses</h2><p>Change the filters or load another JSON file.</p></div>';
}

/** Renders the selected month. */
function renderMonth(): void {
  $("#monthTitle").textContent = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(state.month);
  $("#calGrid").innerHTML = monthCalendar(state.planned(), state.month);
}

/** Renders the selected week. */
function renderWeek(): void {
  const week = weekCalendar(state.planned(), state.week);
  $("#weekTitle").textContent = week.title;
  $("#weekGrid").innerHTML = week.html;
}

/** Renders conflict and missing-information panels. */
function renderPanels(): void {
  $("#questionList").innerHTML = questionsPanel(state.filtered());
  $("#conflictList").innerHTML = conflictsPanel(state.planned());
}

/** Reads saved filter collections. */
function savedLists(): SavedList[] {
  return readStored<SavedList[]>("hfbk-filter-lists", []);
}

/** Renders saved filter collections. */
function renderSavedLists(): void {
  const lists = savedLists();
  $("#savedLists").innerHTML = lists.length
    ? lists
        .map(
          (list, index) =>
            `<div class="saved-item"><button class="mini" data-load="${index}">${esc(list.name)}</button><button class="mini" data-delete="${index}" aria-label="Delete ${esc(list.name)}">×</button></div>`,
        )
        .join("")
    : "<small>No saved lists yet.</small>";
}

/** Opens one top-level view. */
function openView(view: string): void {
  $$<HTMLButtonElement>("[data-view]").forEach((button) =>
    button.classList.toggle("active", button.dataset.view === view),
  );
  $$(".panel").forEach((panel) =>
    panel.classList.toggle("active", panel.id === view),
  );
}

/** Handles filters and course checkboxes. */
document.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.dataset.kind === "subject" || target.dataset.kind === "type") {
    const selection =
      target.dataset.kind === "subject" ? state.subjects : state.types;
    if (target.checked) selection.add(target.value);
    else selection.delete(target.value);
    render();
  }
  if (target.dataset.courseToggle) {
    if (target.checked) state.included.add(target.dataset.courseToggle);
    else state.included.delete(target.dataset.courseToggle);
    state.saveChoices();
    render();
  }
  if (target.dataset.courseRegistered) {
    if (target.checked) state.registered.add(target.dataset.courseRegistered);
    else state.registered.delete(target.dataset.courseRegistered);
    state.saveChoices();
    render();
  }
});

/** Handles static controls and delegated course links. */
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".plan-toggle")) event.stopPropagation();
  const courseLink = target.closest<HTMLAnchorElement>("[data-course-link]");
  if (!courseLink) return;
  event.preventDefault();
  openView("courses");
  const card = $(courseLink.getAttribute("href")!) as HTMLDetailsElement;
  card.open = true;
  card.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#search").addEventListener("input", (event) => {
  state.query = (event.target as HTMLInputElement).value;
  renderCourses();
  renderPanels();
});
$("#includeAll").onclick = () => {
  state.filtered().forEach((course) => state.included.add(course.id));
  state.saveChoices();
  render();
};
$("#excludeAll").onclick = () => {
  state.filtered().forEach((course) => state.included.delete(course.id));
  state.saveChoices();
  render();
};
$("#expandAll").onclick = () =>
  $$<HTMLDetailsElement>(".lecture").forEach((card) => (card.open = true));
$("#collapseAll").onclick = () =>
  $$<HTMLDetailsElement>(".lecture").forEach((card) => (card.open = false));
$("#reset").onclick = () => {
  state.reset();
  $("#search").value = "";
  render();
};

$$<HTMLButtonElement>("[data-view]").forEach((button) => {
  button.onclick = () => openView(button.dataset.view!);
});
$("#prevMonth").onclick = () => {
  state.month = new Date(
    state.month.getFullYear(),
    state.month.getMonth() - 1,
    1,
  );
  renderMonth();
};
$("#nextMonth").onclick = () => {
  state.month = new Date(
    state.month.getFullYear(),
    state.month.getMonth() + 1,
    1,
  );
  renderMonth();
};
$("#prevWeek").onclick = () => {
  state.week = addDays(state.week, -7);
  renderWeek();
};
$("#nextWeek").onclick = () => {
  state.week = addDays(state.week, 7);
  renderWeek();
};

$("#saveList").onclick = () => {
  const input = $("#listName") as HTMLInputElement;
  const name = input.value.trim();
  if (!name) return input.focus();
  const lists = savedLists();
  lists.push({
    name,
    subjects: [...state.subjects],
    types: [...state.types],
    query: state.query,
    included: [...state.included],
    registered: [...state.registered],
  });
  writeStored("hfbk-filter-lists", lists);
  input.value = "";
  renderSavedLists();
};

$("#savedLists").onclick = (event) => {
  const target = event.target as HTMLElement;
  const index = Number(target.dataset.load ?? target.dataset.delete);
  if (Number.isNaN(index)) return;
  const lists = savedLists();
  if (target.dataset.delete !== undefined) {
    lists.splice(index, 1);
    writeStored("hfbk-filter-lists", lists);
    return renderSavedLists();
  }
  const list = lists[index];
  state.subjects = new Set(list.subjects);
  state.types = new Set(list.types);
  state.query = list.query;
  state.included = new Set(list.included);
  state.registered = new Set(list.registered);
  state.saveChoices();
  $("#search").value = state.query;
  render();
};

$("#downloadJson").onclick = () =>
  downloadCatalog(state.courses, state.included, state.registered);
$("#jsonUpload").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    state.replaceCourses(validatePayload(JSON.parse(await file.text())));
    $("#jsonStatus").textContent =
      `Loaded ${state.lectures.length} courses. Nothing was uploaded online.`;
    $("#search").value = "";
    render();
    openView("courses");
  } catch (error) {
    $("#jsonStatus").textContent =
      `Could not read this file: ${(error as Error).message}`;
  } finally {
    input.value = "";
  }
});

render();
if (!state.lectures.length) openView("dataGuide");
