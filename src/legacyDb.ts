import { openDB } from "idb";
import type { Entry } from "./types";

// Read-only access to the pre-sync IndexedDB store, kept solely so existing
// history on a device can be migrated into the shared repo. Nothing writes here
// any more; once a device has been migrated this is dead weight it can drop.
const DB_NAME = "nutrition-tracker";
const DB_VERSION = 1;
const STORE = "entries";

export async function readLegacyEntries(): Promise<Entry[]> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        // Only runs when no local DB exists, in which case there is nothing to
        // migrate; creating the store keeps the open from failing.
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("dateKey", "dateKey", { unique: false });
        }
      },
    });
    if (!db.objectStoreNames.contains(STORE)) return [];
    const all = (await db.getAll(STORE)) as Entry[];
    db.close();
    return all;
  } catch {
    // A browser with IndexedDB blocked has nothing to migrate either.
    return [];
  }
}

export async function clearLegacyEntries(): Promise<void> {
  const db = await openDB(DB_NAME, DB_VERSION);
  await db.clear(STORE);
  db.close();
}
