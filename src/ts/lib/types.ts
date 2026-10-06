/** Compact date, start, and optional end tuple. */
export type EventTuple = [
  date: string,
  start?: string | null,
  end?: string | null,
];

/** Canonical rule for a repeating course. */
export interface Recurrence {
  frequency: "weekly" | "biweekly" | string;
  interval_weeks: number;
  weekday: string;
  start_date: string;
  end_date: string;
  time?: { start: string | null; end: string | null };
}

/** Portable JSON representation edited by users. */
export interface Course {
  id: string;
  plan: boolean;
  classification: { subject: string; type: string };
  text: {
    en: { title: string; body: string };
    de: { title: string; body: string };
    machine_translation?: "en" | "de";
  };
  details: { instructors?: string; room?: string };
  registration: { registered: boolean; email: string };
  calendar: {
    events: EventTuple[];
    recurrence?: Recurrence;
    semester_break_excluded?: string[];
  };
  source?: { pdf_page?: number; user_confirmed_correction?: boolean };
}

/** Versioned catalogue file envelope. */
export interface CoursePayload {
  schema_version: number;
  courses: Course[];
}

/** Course fields derived for rendering and search. */
export interface Lecture {
  id: string;
  page?: number;
  subject: string;
  type: string;
  title_en: string;
  body_en: string;
  title_de: string;
  body_de: string;
  machine_translation_side: "en" | "de" | null;
  instructors: string;
  rooms: string;
  schedule: string;
  dates: string[];
  event_times: Record<string, { start: string | null; end: string | null }>;
  input_issues: string[];
  recurrence: Recurrence | null;
  semester_break_excluded: string[];
  registration_email: string;
  registered_default: boolean;
  plan_default: boolean;
  user_confirmed_correction: boolean;
}
