/** Returns the first matching element. */
export function $<T extends Element = any>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

/** Returns all matching elements as an array. */
export function $$<T extends Element = any>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}

/** Escapes text before HTML interpolation. */
export function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => entities[character] ?? character,
  );
}
