import type { Lecture } from "./types";
import { SUBJECT_COLORS } from "./taxonomy";

export const FOCUS_COLORS = SUBJECT_COLORS;

/** Maps a source subject to its color group. */
export function focus(course: Lecture): string {
  return course.subject;
}

/** Returns the course-group color. */
export function focusColor(course: Lecture): string {
  return FOCUS_COLORS[focus(course)] || "#687078";
}
