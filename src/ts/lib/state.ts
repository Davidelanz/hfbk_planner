import { hydrate } from "./catalog";
import { readStored, writeStored } from "./storage";
import type { Course, Lecture } from "./types";

export type StatusFilter = "plan" | "registered";

const PLAN_KEY = "hfbk-included-courses";
const REGISTERED_KEY = "hfbk-registered-courses";

/** Owns catalogue data, filters, calendars, and user choices. */
export class PlannerState {
  courses: Course[] = [];
  lectures: Lecture[] = [];
  subjects = new Set<string>();
  types = new Set<string>();
  statuses = new Set<StatusFilter>();
  query = "";
  month = new Date();
  week = new Date();
  included = new Set<string>();
  registered = new Set<string>();

  constructor(courses: Course[]) {
    this.replaceCourses(courses, true);
  }

  /** Returns courses matching active filters. */
  filtered(): Lecture[] {
    const query = this.query.toLowerCase();
    return this.lectures.filter(
      (course) =>
        (!this.subjects.size || this.subjects.has(course.subject)) &&
        (!this.types.size || this.types.has(course.type)) &&
        (!this.statuses.size ||
          (this.statuses.has("plan") && this.included.has(course.id)) ||
          (this.statuses.has("registered") &&
            this.registered.has(course.id))) &&
        (!query || JSON.stringify(course).toLowerCase().includes(query)),
    );
  }

  /** Returns filtered courses included in the plan. */
  planned(): Lecture[] {
    return this.filtered().filter((course) => this.included.has(course.id));
  }

  /** Replaces catalogue data and resets transient filters. */
  replaceCourses(courses: Course[], restoreStored = false): void {
    this.courses = courses;
    this.lectures = hydrate(courses);
    this.subjects.clear();
    this.types.clear();
    this.statuses.clear();
    this.query = "";

    const ids = new Set(this.lectures.map((course) => course.id));
    const defaultPlan = this.lectures
      .filter((course) => course.plan_default)
      .map((course) => course.id);
    const defaultRegistered = this.lectures
      .filter((course) => course.registered_default)
      .map((course) => course.id);
    const storedPlan = restoreStored
      ? readStored<string[] | null>(PLAN_KEY, null)
      : null;
    const storedRegistered = restoreStored
      ? readStored<string[] | null>(REGISTERED_KEY, null)
      : null;

    this.included = new Set(
      (storedPlan || defaultPlan).filter((id) => ids.has(id)),
    );
    this.registered = new Set(
      (storedRegistered || defaultRegistered).filter((id) => ids.has(id)),
    );

    const firstDate = this.lectures.flatMap((course) => course.dates).sort()[0];
    if (firstDate) {
      this.month = new Date(`${firstDate}T12:00:00`);
      this.week = new Date(`${firstDate}T12:00:00`);
    }
  }

  /** Restores JSON defaults and clears filters. */
  reset(): void {
    this.replaceCourses(this.courses);
    this.saveChoices();
  }

  /** Adds one course without discarding existing user choices. */
  addCourse(course: Course): void {
    this.courses.push(course);
    this.lectures = hydrate(this.courses);
    if (course.plan) this.included.add(course.id);
    if (course.registration.registered) this.registered.add(course.id);
    this.saveChoices();
  }

  /** Replaces one course while preserving the other catalogue entries. */
  updateCourse(course: Course): void {
    const index = this.courses.findIndex((item) => item.id === course.id);
    if (index < 0) throw new Error(`Course ${course.id} no longer exists.`);

    this.courses[index] = course;
    this.lectures = hydrate(this.courses);
    if (course.plan) this.included.add(course.id);
    else this.included.delete(course.id);
    if (course.registration.registered) this.registered.add(course.id);
    else this.registered.delete(course.id);
    this.saveChoices();
  }

  /** Deletes one course and removes its saved plan choices. */
  deleteCourse(id: string): void {
    const index = this.courses.findIndex((course) => course.id === id);
    if (index < 0) throw new Error(`Course ${id} no longer exists.`);

    this.courses.splice(index, 1);
    this.lectures = hydrate(this.courses);
    this.included.delete(id);
    this.registered.delete(id);
    this.saveChoices();
  }

  /** Persists plan and registration choices. */
  saveChoices(): void {
    writeStored(PLAN_KEY, [...this.included]);
    writeStored(REGISTERED_KEY, [...this.registered]);
  }
}
