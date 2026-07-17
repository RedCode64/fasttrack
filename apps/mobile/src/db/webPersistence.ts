/**
 * Web-only durable storage for the sql.js database. The browser pane has no
 * filesystem, so we snapshot the whole SQLite image (Uint8Array from
 * `db.export()`) into IndexedDB and restore it on the next open. This is what
 * lets a returning user skip onboarding instead of re-entering their business
 * on every reload. Device builds never touch this — expo-sqlite is durable.
 */

const DB_NAME = "fasttrack-web";
const STORE = "sqlite";
const KEY = "app-db";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

/** Restore the last saved database image, or null if there is none. */
export async function loadDbImage(): Promise<Uint8Array | null> {
  if (!hasIndexedDb()) return null;
  try {
    const idb = await openIndexedDb();
    try {
      return await new Promise<Uint8Array | null>((resolve, reject) => {
        const request = idb.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
        request.onsuccess = () => {
          const value = request.result as ArrayBuffer | Uint8Array | undefined;
          if (!value) resolve(null);
          else resolve(value instanceof Uint8Array ? value : new Uint8Array(value));
        };
        request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
      });
    } finally {
      idb.close();
    }
  } catch {
    // A blocked or unavailable IndexedDB should degrade to a fresh session,
    // never crash app startup.
    return null;
  }
}

/** Overwrite the saved database image with the current snapshot. */
export async function saveDbImage(bytes: Uint8Array): Promise<void> {
  if (!hasIndexedDb()) return;
  const idb = await openIndexedDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(bytes, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    });
  } finally {
    idb.close();
  }
}
