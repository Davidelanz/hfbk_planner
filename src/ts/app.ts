import { courseCard } from "./components/course-card";
import {
  courseFromForm,
  DEFAULT_SUBJECTS,
  DEFAULT_TYPES,
  eventRow,
  fillSelect,
  populateCourseForm,
} from "./components/course-form";
import { monthCalendar } from "./components/month-calendar";
import { conflictsPanel, questionsPanel } from "./components/panels";
import { weekCalendar } from "./components/week-calendar";
import { loadCatalog } from "./lib/catalog";
import {
  catalogJson,
  validatePayload,
  downloadCatalog,
} from "./lib/data-transfer";
import { addDays } from "./lib/dates";
import { $, $$, escapeHtml as esc } from "./lib/dom";
import { FOCUS_COLORS, focus } from "./lib/focus";
import { PlannerState } from "./lib/state";
import type { StatusFilter } from "./lib/state";
import { readStored, writeStored } from "./lib/storage";
import {
  chooseLocalCatalog,
  createLocalCatalog,
  forgetLocalCatalog,
  readLocalCatalog,
  rememberedLocalCatalog,
  supportsLocalCatalogLink,
  writeLocalCatalog,
} from "./lib/local-catalog-file";
import type { LocalCatalogHandle } from "./lib/local-catalog-file";

interface SavedList {
  name: string;
  subjects: string[];
  types: string[];
  statuses?: StatusFilter[];
  query: string;
  included: string[];
  registered: string[];
}

type CourseSort = "subject" | "start-date" | "type" | "teacher";

const payload = await loadCatalog();
const state = new PlannerState(payload.courses);
let editingCourseId: string | null = null;
let courseSort: CourseSort = "subject";
let linkedCatalog: LocalCatalogHandle | null = null;
let localSaveQueue = Promise.resolve();

/** Queues a complete snapshot so rapid edits cannot overwrite newer data. */
function autosaveLinkedCatalog(): void {
  if (!linkedCatalog) return;
  const handle = linkedCatalog;
  const snapshot = catalogJson(state.courses, state.included, state.registered);
  $("#localFileStatus").textContent = `Saving to ${handle.name}...`;
  localSaveQueue = localSaveQueue
    .catch(() => undefined)
    .then(() => writeLocalCatalog(handle, snapshot))
    .then(() => {
      if (linkedCatalog === handle) {
        $("#localFileStatus").textContent =
          `Saved automatically to ${handle.name}.`;
      }
    })
    .catch((error) => {
      $("#localFileStatus").textContent =
        `Autosave failed: ${(error as Error).message}`;
    });
}

/** Renders every view from current state. */
function render(): void {
  renderFilters();
  renderCourses();
  renderMonth();
  renderWeek();
  renderPanels();
  renderSavedLists();
  renderCourseOptions();
}

/** Updates guided-form selects from current catalogue values. */
function renderCourseOptions(): void {
  fillSelect(
    $<HTMLSelectElement>("#courseSubject"),
    state.courses.map((course) => course.classification.subject),
    DEFAULT_SUBJECTS,
  );
  fillSelect(
    $<HTMLSelectElement>("#courseType"),
    state.courses.map((course) => course.classification.type),
    DEFAULT_TYPES,
  );
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
  $("#statuses").innerHTML = [
    filterControl("status", "plan", state.statuses.has("plan"), "In plan"),
    filterControl(
      "status",
      "registered",
      state.statuses.has("registered"),
      "Registered",
    ),
  ].join("");
  $("#legend").innerHTML = [...new Set(state.lectures.map(focus))]
    .map(
      (group) =>
        `<span style="--legend:${FOCUS_COLORS[group]}">${esc(group)}</span>`,
    )
    .join("");
}

/** Builds one checked filter control. */
function filterControl(
  kind: string,
  value: string,
  checked: boolean,
  label = value,
): string {
  return `<label class="check"><input type="checkbox" value="${esc(value)}" data-kind="${kind}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
}

/** Renders course cards and the result count. */
function renderCourses(): void {
  const courses = [...state.filtered()].sort(compareCourses);
  const included = courses.filter((course) =>
    state.included.has(course.id),
  ).length;
  $("#count").textContent = `${included} in plan · ${courses.length} courses`;
  const emptyMessage = state.lectures.length
    ? '<div class="empty"><h2>No matching courses</h2><p>Change or reset the filters to see courses again.</p></div>'
    : `<div class="empty"><h2>No course data yet</h2><p>Open <strong>Getting started</strong> to create or connect a data file, or create your first course in the <strong>Add course</strong> tab.</p><div class="empty-actions"><button class="btn dark" type="button" data-open-view="dataGuide">Getting started</button><button class="btn" type="button" data-open-view="addCourse">Add a course</button></div></div>`;
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
    : emptyMessage;
}

/** Sorts course cards by the selected overview order. */
function compareCourses(
  left: (typeof state.lectures)[number],
  right: (typeof state.lectures)[number],
): number {
  const titleCompare = compareText(
    left.title_en || left.title_de,
    right.title_en || right.title_de,
  );
  if (courseSort === "start-date") {
    const leftDate = earliestDate(left.dates);
    const rightDate = earliestDate(right.dates);
    return compareMissingLast(leftDate, rightDate) || titleCompare;
  }
  if (courseSort === "type") {
    return compareText(left.type, right.type) || titleCompare;
  }
  if (courseSort === "teacher") {
    return (
      compareMissingLast(left.instructors, right.instructors) || titleCompare
    );
  }
  return (
    compareText(left.subject, right.subject) ||
    compareText(left.type, right.type) ||
    titleCompare
  );
}

function earliestDate(dates: string[]): string {
  return dates.reduce(
    (earliest, date) => (!earliest || date < earliest ? date : earliest),
    "",
  );
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function compareMissingLast(left: string, right: string): number {
  if (!left) return right ? 1 : 0;
  if (!right) return -1;
  return compareText(left, right);
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
  const filtered = state.filtered();
  const hasQuestions = filtered.some((course) => course.input_issues.length);
  const questionsButton = $<HTMLButtonElement>('[data-view="questions"]');
  questionsButton.hidden = !hasQuestions;
  if (!hasQuestions && $("#questions").classList.contains("active")) {
    openView("courses");
  }
  $("#questionList").innerHTML = questionsPanel(filtered);
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

/** Opens the guided form for editing or copying a course. */
function openCourseForm(courseId: string, duplicate = false): void {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) {
    $("#courseFormStatus").textContent = "This course is no longer available.";
    return;
  }
  editingCourseId = duplicate ? null : course.id;
  populateCourseForm(courseForm, course);
  courseForm.querySelector<HTMLInputElement>('[name="plan"]')!.checked =
    state.included.has(course.id);
  courseForm.querySelector<HTMLInputElement>('[name="registered"]')!.checked =
    state.registered.has(course.id);
  $("#courseFormTitle").textContent = duplicate
    ? "Duplicate course"
    : "Edit course";
  $("#courseFormSubmit").textContent = duplicate
    ? "Add duplicate"
    : "Save changes";
  $("#courseFormStatus").textContent = duplicate
    ? "Review the copied information, then add it as a new course."
    : "";
  syncDateModeUI();
  openView("addCourse");
  courseForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
  if (target.dataset.kind === "status") {
    const status = target.value as StatusFilter;
    if (target.checked) state.statuses.add(status);
    else state.statuses.delete(status);
    render();
  }
  if (target.dataset.courseToggle) {
    if (target.checked) state.included.add(target.dataset.courseToggle);
    else state.included.delete(target.dataset.courseToggle);
    state.saveChoices();
    autosaveLinkedCatalog();
    render();
  }
  if (target.dataset.courseRegistered) {
    if (target.checked) state.registered.add(target.dataset.courseRegistered);
    else state.registered.delete(target.dataset.courseRegistered);
    state.saveChoices();
    autosaveLinkedCatalog();
    render();
  }
});

/** Handles static controls and delegated course links. */
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".plan-toggle")) event.stopPropagation();
  const viewButton = target.closest<HTMLButtonElement>("[data-open-view]");
  if (viewButton) {
    openView(viewButton.dataset.openView!);
    return;
  }
  const editButton = target.closest<HTMLButtonElement>("[data-edit-course]");
  if (editButton) {
    event.preventDefault();
    event.stopPropagation();
    openCourseForm(editButton.dataset.editCourse!);
    return;
  }
  const duplicateButton = target.closest<HTMLButtonElement>(
    "[data-duplicate-course]",
  );
  if (duplicateButton) {
    event.preventDefault();
    event.stopPropagation();
    openCourseForm(duplicateButton.dataset.duplicateCourse!, true);
    return;
  }
  const deleteButton = target.closest<HTMLButtonElement>(
    "[data-delete-course]",
  );
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const id = deleteButton.dataset.deleteCourse!;
    const course = state.lectures.find((item) => item.id === id);
    if (!course) return;
    const title = course.title_en || course.title_de || "this course";
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    state.deleteCourse(id);
    autosaveLinkedCatalog();
    if (editingCourseId === id) {
      editingCourseId = null;
      courseForm.reset();
    }
    render();
    return;
  }
  const courseLink = target.closest<HTMLAnchorElement>("[data-course-link]");
  if (!courseLink) return;
  event.preventDefault();
  openView("courses");
  const card = $(courseLink.getAttribute("href")!) as HTMLDetailsElement;
  card.open = true;
  card.scrollIntoView({ behavior: "smooth", block: "start" });
});

$<HTMLInputElement>("#search").addEventListener("input", (event) => {
  state.query = (event.target as HTMLInputElement).value;
  renderCourses();
  renderPanels();
});
$("#includeAll").onclick = () => {
  state.filtered().forEach((course) => state.included.add(course.id));
  state.saveChoices();
  autosaveLinkedCatalog();
  render();
};
$("#excludeAll").onclick = () => {
  state.filtered().forEach((course) => state.included.delete(course.id));
  state.saveChoices();
  autosaveLinkedCatalog();
  render();
};
$("#expandAll").onclick = () =>
  $$<HTMLDetailsElement>(".lecture").forEach((card) => (card.open = true));
$("#collapseAll").onclick = () =>
  $$<HTMLDetailsElement>(".lecture").forEach((card) => (card.open = false));
$<HTMLSelectElement>("#courseSort").addEventListener("change", (event) => {
  courseSort = (event.target as HTMLSelectElement).value as CourseSort;
  renderCourses();
});
$("#reset").onclick = () => {
  state.reset();
  autosaveLinkedCatalog();
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
    statuses: [...state.statuses],
    query: state.query,
    included: [...state.included],
    registered: [...state.registered],
  });
  writeStored("hfbk-filter-lists", lists);
  input.value = "";
  renderSavedLists();
};

$<HTMLDivElement>("#savedLists").onclick = (event) => {
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
  state.statuses = new Set(list.statuses ?? []);
  state.query = list.query;
  state.included = new Set(list.included);
  state.registered = new Set(list.registered);
  state.saveChoices();
  autosaveLinkedCatalog();
  $("#search").value = state.query;
  render();
};

$("#downloadJson").onclick = () =>
  downloadCatalog(state.courses, state.included, state.registered);
$<HTMLButtonElement>("#downloadBlankJson").onclick = () =>
  startBlankImportedCatalog();

function startBlankImportedCatalog(): void {
  if (
    state.courses.length &&
    !window.confirm(
      "Start a new schedule? Unsaved changes in the current schedule will be cleared.",
    )
  ) {
    return;
  }
  state.replaceCourses([]);
  $("#search").value = "";
  $("#jsonStatus").textContent =
    "New schedule started. Export the data file when you want to save it.";
  render();
  openView("addCourse");
}

function showLinkedCatalog(handle: LocalCatalogHandle): void {
  linkedCatalog = handle;
  $("#localFileStatus").textContent =
    `Connected to ${handle.name}. Changes save automatically.`;
  $("#disconnectRow").hidden = false;
}

async function loadLinkedCatalog(
  handle: LocalCatalogHandle,
  requestPermission: boolean,
): Promise<void> {
  const permission = requestPermission
    ? await handle.requestPermission({ mode: "readwrite" })
    : await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    linkedCatalog = handle;
    $("#localFileStatus").textContent =
      `Reconnect ${handle.name} to continue loading and autosaving.`;
    $("#disconnectRow").hidden = false;
    return;
  }
  state.replaceCourses(await readLocalCatalog(handle));
  $("#search").value = "";
  showLinkedCatalog(handle);
  render();
  openView("courses");
}

$<HTMLButtonElement>("#connectJson").onclick = async () => {
  try {
    if (linkedCatalog) {
      await loadLinkedCatalog(linkedCatalog, true);
    } else {
      await loadLinkedCatalog(await chooseLocalCatalog(), true);
    }
  } catch (error) {
    if ((error as DOMException).name === "AbortError") return;
    $("#localFileStatus").textContent =
      `Could not connect the file: ${(error as Error).message}`;
  }
};

$<HTMLButtonElement>("#createJson").onclick = async () => {
  try {
    const handle = await createLocalCatalog();
    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      throw new Error("Permission to save the file was not granted.");
    }
    state.replaceCourses([]);
    await writeLocalCatalog(
      handle,
      catalogJson(state.courses, state.included, state.registered),
    );
    showLinkedCatalog(handle);
    $("#search").value = "";
    render();
    openView("addCourse");
  } catch (error) {
    if ((error as DOMException).name === "AbortError") return;
    $("#localFileStatus").textContent =
      `Could not create the file: ${(error as Error).message}`;
  }
};

$<HTMLButtonElement>("#disconnectJson").onclick = async () => {
  await forgetLocalCatalog();
  linkedCatalog = null;
  localSaveQueue = Promise.resolve();
  $("#localFileStatus").textContent =
    "Disconnected. The file was not changed or deleted.";
  $("#disconnectRow").hidden = true;
};

$<HTMLInputElement>("#jsonUpload").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  $("#selectedFileName").textContent = file.name;
  try {
    state.replaceCourses(validatePayload(JSON.parse(await file.text())));
    $("#jsonStatus").textContent =
      `Loaded ${state.lectures.length} courses. Nothing was uploaded online.`;
    $("#search").value = "";
    linkedCatalog = null;
    await forgetLocalCatalog();
    $("#disconnectRow").hidden = true;
    render();
    openView("courses");
  } catch (error) {
    $("#jsonStatus").textContent =
      `Could not read this file: ${(error as Error).message}`;
  } finally {
    input.value = "";
  }
});

const courseForm = $<HTMLFormElement>("#courseForm");
const eventRows = $<HTMLDivElement>("#eventRows");

function syncDateModeUI(): void {
  const mode =
    courseForm.querySelector<HTMLInputElement>(
      'input[name="date-mode"]:checked',
    )?.value ?? "exact";
  const exact = $<HTMLDivElement>("#exactDateFields");
  const repeating = $<HTMLDivElement>("#recurringDateFields");
  const isRepeating = mode === "repeating";
  exact.hidden = isRepeating;
  repeating.hidden = !isRepeating;
}

/** Restores one empty date row. */
function resetEventRows(): void {
  eventRows.innerHTML = eventRow();
}

$("#addEventDate").onclick = () =>
  eventRows.insertAdjacentHTML("beforeend", eventRow());

courseForm.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.name === "date-mode") syncDateModeUI();
});

eventRows.onclick = (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    ".remove-event",
  );
  if (!button) return;
  button.closest(".event-row")?.remove();
  if (!eventRows.children.length) resetEventRows();
};

courseForm.addEventListener("reset", () => {
  requestAnimationFrame(() => {
    editingCourseId = null;
    $("#courseFormTitle").textContent = "Add a course";
    $("#courseFormSubmit").textContent = "Add course";
    resetEventRows();
    syncDateModeUI();
    $("#courseFormStatus").textContent = "";
  });
});

courseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const isEditing = editingCourseId !== null;
    const existingCourse = editingCourseId
      ? state.courses.find((item) => item.id === editingCourseId)
      : undefined;
    if (editingCourseId && !existingCourse) {
      throw new Error("This course is no longer available to edit.");
    }
    const course = courseFromForm(courseForm, existingCourse);
    if (isEditing) state.updateCourse(course);
    else state.addCourse(course);
    autosaveLinkedCatalog();
    state.subjects.clear();
    state.types.clear();
    state.query = "";
    $<HTMLInputElement>("#search").value = "";
    editingCourseId = null;
    $("#courseFormTitle").textContent = "Add a course";
    $("#courseFormSubmit").textContent = "Add course";
    courseForm.reset();
    render();
    openView("courses");
    requestAnimationFrame(() => {
      const card = $<HTMLDetailsElement>(`#${CSS.escape(course.id)}`);
      card.open = true;
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } catch (error) {
    $("#courseFormStatus").textContent = (error as Error).message;
  }
});

resetEventRows();
syncDateModeUI();
render();
if (!state.lectures.length) openView("dataGuide");

if (!supportsLocalCatalogLink()) {
  $("#manualFileMode").hidden = false;
} else {
  $("#linkedFileMode").hidden = false;
  void rememberedLocalCatalog()
    .then((handle) => {
      if (handle) return loadLinkedCatalog(handle, false);
    })
    .catch((error) => {
      $("#localFileStatus").textContent =
        `Could not restore the file link: ${(error as Error).message}`;
    });
}
