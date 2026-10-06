import type { Lecture } from "./types";

export const FOCUS_COLORS: Record<string, string> = {
  "Sculpture / Stage Design": "#e4572e",
  Photography: "#008f7a",
  Film: "#6554c0",
  "Theory / History": "#b84387",
  Design: "#2176ae",
  "Painting / Drawing": "#d18b00",
  "Time-Based Media": "#0077b6",
  "Art Education": "#5c8001",
  "Workshops / Labs": "#c8553d",
  Other: "#687078",
};

/** Maps a source subject to its color group. */
export function focus(course: Lecture): string {
  const subject = course.subject || "";
  if (/Sculpture|Stage Design/.test(subject)) return "Sculpture / Stage Design";
  if (/Photography|Graphic Art/.test(subject)) return "Photography";
  if (/Film/.test(subject)) return "Film";
  if (/Theory|History/.test(subject)) return "Theory / History";
  if (/Design/.test(subject)) return "Design";
  if (/Painting|Drawing/.test(subject)) return "Painting / Drawing";
  if (/Time-Based/.test(subject)) return "Time-Based Media";
  if (/Art Education/.test(subject)) return "Art Education";
  if (/Workshop|Laborator/.test(subject)) return "Workshops / Labs";
  return "Other";
}

/** Returns the course-group color. */
export function focusColor(course: Lecture): string {
  return FOCUS_COLORS[focus(course)] || FOCUS_COLORS.Other;
}
