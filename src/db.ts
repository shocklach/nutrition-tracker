import { openDB, type IDBPDatabase } from "idb";
import type { Entry, DaySummary } from "./types";
import { round1 } from "./utils";

const DB_NAME = "nutrition-tracker";
const DB_VERSION = 1;
const STORE = "entries";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("dateKey", "dateKey", { unique: false });
      },
    });
  }
  return dbPromise;
}

export async function addEntry(entry: Entry): Promise<void> {
  const db = await getDb();
  await db.add(STORE, entry);
}

export async function updateEntry(
  id: string,
  updates: Partial<Pick<Entry, "proteinGrams" | "calories" | "saturatedFatGrams" | "fiberGrams">>
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  const existing = await tx.store.get(id);
  if (!existing) throw new Error("Entry not found");
  Object.assign(existing, updates);
  await tx.store.put(existing);
  await tx.done;
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function listEntriesByDateKey(dateKey: string): Promise<Entry[]> {
  const db = await getDb();
  return db.getAllFromIndex(STORE, "dateKey", dateKey);
}

export async function listRecentDays(n: number): Promise<DaySummary[]> {
  const db = await getDb();
  const all: Entry[] = await db.getAll(STORE);

  const map = new Map<string, { totalProtein: number; totalCalories: number; totalSaturatedFat: number; totalFiber: number; entryCount: number }>();
  for (const e of all) {
    let day = map.get(e.dateKey);
    if (!day) {
      day = { totalProtein: 0, totalCalories: 0, totalSaturatedFat: 0, totalFiber: 0, entryCount: 0 };
      map.set(e.dateKey, day);
    }
    day.totalProtein += e.proteinGrams;
    day.totalCalories += e.calories;
    day.totalSaturatedFat += e.saturatedFatGrams ?? 0;
    day.totalFiber += e.fiberGrams ?? 0;
    day.entryCount += 1;
  }

  const summaries: DaySummary[] = Array.from(map.entries()).map(([dateKey, d]) => ({
    dateKey,
    totalProtein: d.totalProtein,
    totalCalories: d.totalCalories,
    totalSaturatedFat: round1(d.totalSaturatedFat),
    totalFiber: round1(d.totalFiber),
    entryCount: d.entryCount,
  }));

  summaries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return summaries.slice(0, n);
}

export async function exportCsv(dateKeys?: string[]): Promise<string> {
  const db = await getDb();
  const all: Entry[] = await db.getAll(STORE);

  const map = new Map<string, { totalProtein: number; totalCalories: number; totalSaturatedFat: number; totalFiber: number }>();
  for (const e of all) {
    if (dateKeys && !dateKeys.includes(e.dateKey)) continue;
    let day = map.get(e.dateKey);
    if (!day) {
      day = { totalProtein: 0, totalCalories: 0, totalSaturatedFat: 0, totalFiber: 0 };
      map.set(e.dateKey, day);
    }
    day.totalProtein += e.proteinGrams;
    day.totalCalories += e.calories;
    day.totalSaturatedFat += e.saturatedFatGrams ?? 0;
    day.totalFiber += e.fiberGrams ?? 0;
  }

  const rows = Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(
      ([dateKey, d]) =>
        `${dateKey},${d.totalProtein},${d.totalCalories},${round1(d.totalSaturatedFat)},${round1(d.totalFiber)}`
    );

  return [
    "date,total_protein_grams,total_calories,total_saturated_fat_grams,total_fiber_grams",
    ...rows,
  ].join("\n");
}
