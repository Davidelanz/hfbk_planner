import type { Course } from "./types";

export const SUBJECTS = [
  "Bildhauerei",
  "Bühnenraum",
  "Design",
  "Film",
  "Grafik/Fotografie",
  "Malerei/Zeichnen",
  "Zeitbezogene Medien",
  "Theorie und Geschichte",
  "Other",
] as const;

export const COURSE_TYPES = [
  "Foundation course",
  "Seminar",
  "Workshop",
  "Group correction",
  "Individual correction",
  "Screening",
  "Excursion",
  "Other",
] as const;

export const SUBJECT_COLORS: Record<string, string> = {
  Bildhauerei: "#e4572e",
  Bühnenraum: "#9b5de5",
  Design: "#2176ae",
  Film: "#6554c0",
  "Grafik/Fotografie": "#008f7a",
  "Malerei/Zeichnen": "#d18b00",
  "Zeitbezogene Medien": "#0077b6",
  "Theorie und Geschichte": "#b84387",
  Other: "#68737d",
};

const SUBJECT_ALIASES: Record<string, string> = {
  "Orientation · Sculpture / Stage Design": "Bildhauerei",
  Sculpture: "Bildhauerei",
  "Stage Design": "Bühnenraum",
  "Orientation · Design": "Design",
  "Orientation · Film": "Film",
  "Graphic Art / Photography": "Grafik/Fotografie",
  "Orientation · Graphic Art / Photography": "Grafik/Fotografie",
  "Painting / Drawing": "Malerei/Zeichnen",
  "Orientation · Painting / Drawing": "Malerei/Zeichnen",
  "Time-Based Media": "Zeitbezogene Medien",
  "Orientation · Time-Based Media": "Zeitbezogene Medien",
  "Theory / History": "Theorie und Geschichte",
};

/** Returns an official HFBK study focus when an old label is recognised. */
export function normalizeSubject(value: string): string {
  if (SUBJECTS.includes(value as (typeof SUBJECTS)[number])) return value;
  return SUBJECT_ALIASES[value] || "Other";
}

/** Returns one controlled teaching format. */
export function normalizeCourseType(value: string): string {
  if (COURSE_TYPES.includes(value as (typeof COURSE_TYPES)[number]))
    return value;
  return "Other";
}

/** Normalizes imported classification labels without changing other data. */
export function normalizeCourseTaxonomy(course: Course): Course {
  return {
    ...course,
    classification: {
      subject: normalizeSubject(course.classification.subject),
      type: normalizeCourseType(course.classification.type),
    },
  };
}
