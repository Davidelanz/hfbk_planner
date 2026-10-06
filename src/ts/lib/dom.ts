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
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
