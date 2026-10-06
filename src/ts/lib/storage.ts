/** Reads JSON from browser storage with a fallback. */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

/** Writes JSON to browser storage. */
export function writeStored(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
