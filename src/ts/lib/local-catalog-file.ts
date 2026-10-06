import type { Course } from "./types";
import { validatePayload } from "./data-transfer";

const DATABASE_NAME = "hfbk-course-planner";
const STORE_NAME = "file-handles";
const HANDLE_KEY = "catalog";

export type LocalCatalogHandle = FileSystemFileHandle & {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
};

declare global {
  interface Window {
    showOpenFilePicker?: (options: {
      multiple: boolean;
      types: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<LocalCatalogHandle[]>;
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<LocalCatalogHandle>;
  }
}

/** Whether this browser can maintain a writable link to a local file. */
export function supportsLocalCatalogLink(): boolean {
  return (
    typeof window.showOpenFilePicker === "function" &&
    typeof window.showSaveFilePicker === "function"
  );
}

/** Creates, remembers, and returns a new empty catalogue file. */
export async function createLocalCatalog(): Promise<LocalCatalogHandle> {
  if (!window.showSaveFilePicker) {
    throw new Error("Local file creation is not available.");
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: "hfbk-courses.json",
    types: [
      {
        description: "Course catalogue (JSON)",
        accept: { "application/json": [".json"] },
      },
    ],
  });
  await rememberHandle(handle);
  return handle;
}

/** Lets the user choose a catalogue and remembers its file handle. */
export async function chooseLocalCatalog(): Promise<LocalCatalogHandle> {
  if (!window.showOpenFilePicker) {
    throw new Error("This browser does not support linked local files.");
  }
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: "Course catalogue (JSON)",
        accept: { "application/json": [".json"] },
      },
    ],
  });
  await rememberHandle(handle);
  return handle;
}

/** Returns a file handle remembered by this browser, if one exists. */
export async function rememberedLocalCatalog(): Promise<LocalCatalogHandle | null> {
  return databaseRequest<LocalCatalogHandle | undefined>("readonly", (store) =>
    store.get(HANDLE_KEY),
  ).then((handle) => handle ?? null);
}

/** Removes the remembered link without changing or deleting the local file. */
export async function forgetLocalCatalog(): Promise<void> {
  await databaseRequest("readwrite", (store) => store.delete(HANDLE_KEY));
}

/** Reads and validates the courses in a linked catalogue. */
export async function readLocalCatalog(
  handle: LocalCatalogHandle,
): Promise<Course[]> {
  const file = await handle.getFile();
  return validatePayload(JSON.parse(await file.text()));
}

/** Replaces the linked catalogue contents with the current app data. */
export async function writeLocalCatalog(
  handle: LocalCatalogHandle,
  contents: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function rememberHandle(handle: LocalCatalogHandle): Promise<void> {
  await databaseRequest("readwrite", (store) => store.put(handle, HANDLE_KEY));
}

function databaseRequest<T>(
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE_NAME, 1);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE_NAME)) {
        opening.result.createObjectStore(STORE_NAME);
      }
    };
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const database = opening.result;
      const transaction = database.transaction(STORE_NAME, mode);
      const result = request(transaction.objectStore(STORE_NAME));
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
      transaction.oncomplete = () => database.close();
    };
  });
}
