import type { DaySummary, Entry, LogFile, SyncState } from "./types";
import { loadConfig } from "./config";
import { mutateLog, readLog } from "./github";
import { round1 } from "./utils";

const CACHE_KEY = "nutrition-tracker.cache";

// The repo is the source of truth. This mirror exists so the app paints
// instantly on open and still shows the last known day if the network is down.
let entries: Entry[] = readCache();
let loaded = false;
let inFlight: Promise<void> | null = null;

let syncState: SyncState = loadConfig() ? { status: "loading" } : { status: "unconfigured" };
const listeners = new Set<(state: SyncState) => void>();

function readCache(): Entry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { entries?: Entry[] };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function writeCache(next: Entry[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ entries: next }));
  } catch {
    // Quota or private-mode failures only cost us the warm start.
  }
}

function setState(next: SyncState): void {
  syncState = next;
  for (const listener of listeners) listener(next);
}

export function getSyncState(): SyncState {
  return syncState;
}

export function subscribeSync(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function requireConfig() {
  const config = loadConfig();
  if (!config) throw new Error("Not connected to a log repo yet.");
  return config;
}

function adopt(log: LogFile): void {
  entries = log.entries;
  writeCache(entries);
  loaded = true;
  setState({ status: "ready", lastSyncedAt: new Date().toISOString() });
}

function failed(err: unknown): never {
  const message = err instanceof Error ? err.message : "Sync failed.";
  setState({ status: "error", message });
  throw err;
}

/** Pull the log from the repo. Safe to call repeatedly; concurrent calls share one fetch. */
export async function refresh(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    setState({ status: "unconfigured" });
    return;
  }
  if (inFlight) return inFlight;

  setState({ status: "loading" });
  inFlight = (async () => {
    try {
      const { log } = await readLog(config);
      adopt(log);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed.";
      setState({ status: "error", message });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function ensureLoaded(): Promise<void> {
  if (loaded || !loadConfig()) return;
  await refresh();
}

async function apply(message: string, mutate: (list: Entry[]) => Entry[]): Promise<void> {
  const config = requireConfig();
  try {
    const log = await mutateLog(config, message, (current) => ({
      version: 1,
      entries: mutate(current.entries),
    }));
    adopt(log);
  } catch (err) {
    failed(err);
  }
}

export async function addEntry(entry: Entry): Promise<void> {
  const label = entry.note ? ` — ${entry.note}` : "";
  await apply(`Log ${entry.dateKey}${label}`, (list) => [...list, entry]);
}

export async function updateEntry(
  id: string,
  updates: Partial<
    Pick<Entry, "proteinGrams" | "calories" | "saturatedFatGrams" | "fiberGrams" | "note">
  >
): Promise<void> {
  await apply(`Edit entry ${id.slice(0, 8)}`, (list) => {
    const target = list.find((e) => e.id === id);
    if (!target) throw new Error("Entry not found — it may have been deleted elsewhere.");
    return list.map((e) => (e.id === id ? { ...e, ...updates } : e));
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await apply(`Delete entry ${id.slice(0, 8)}`, (list) => list.filter((e) => e.id !== id));
}

/**
 * Merge entries from a legacy device export into the log.
 *
 * Existing ids win, so re-running an import is a no-op rather than a duplicate.
 * A second pass catches the same meal carrying different ids across devices,
 * which cannot happen for genuinely distinct entries — timestamps are
 * millisecond-precision.
 */
export async function importEntries(
  incoming: Entry[]
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  const fingerprint = (e: Entry) =>
    `${e.timestamp}|${e.proteinGrams}|${e.calories}|${e.saturatedFatGrams}|${e.fiberGrams}`;

  await apply(`Import ${incoming.length} entries from a device`, (list) => {
    const byId = new Set(list.map((e) => e.id));
    const byFingerprint = new Set(list.map(fingerprint));
    const merged = [...list];

    for (const entry of incoming) {
      if (byId.has(entry.id) || byFingerprint.has(fingerprint(entry))) {
        skipped++;
        continue;
      }
      byId.add(entry.id);
      byFingerprint.add(fingerprint(entry));
      merged.push(entry);
      added++;
    }
    return merged;
  });

  return { added, skipped };
}

export async function listEntriesByDateKey(dateKey: string): Promise<Entry[]> {
  await ensureLoaded();
  return entries.filter((e) => e.dateKey === dateKey);
}

export async function getAllEntries(): Promise<Entry[]> {
  await ensureLoaded();
  return [...entries];
}

function summarise(list: Entry[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const e of list) {
    let day = map.get(e.dateKey);
    if (!day) {
      day = {
        dateKey: e.dateKey,
        totalProtein: 0,
        totalCalories: 0,
        totalSaturatedFat: 0,
        totalFiber: 0,
        entryCount: 0,
      };
      map.set(e.dateKey, day);
    }
    day.totalProtein += e.proteinGrams;
    day.totalCalories += e.calories;
    day.totalSaturatedFat += e.saturatedFatGrams ?? 0;
    day.totalFiber += e.fiberGrams ?? 0;
    day.entryCount += 1;
  }
  for (const day of map.values()) {
    day.totalSaturatedFat = round1(day.totalSaturatedFat);
    day.totalFiber = round1(day.totalFiber);
  }
  return map;
}

export async function listRecentDays(n: number): Promise<DaySummary[]> {
  await ensureLoaded();
  return Array.from(summarise(entries).values())
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, n);
}

export async function exportCsv(dateKeys?: string[]): Promise<string> {
  await ensureLoaded();
  const scoped = dateKeys ? entries.filter((e) => dateKeys.includes(e.dateKey)) : entries;

  const rows = Array.from(summarise(scoped).values())
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .map(
      (d) =>
        `${d.dateKey},${d.totalProtein},${d.totalCalories},${d.totalSaturatedFat},${d.totalFiber}`
    );

  return [
    "date,total_protein_grams,total_calories,total_saturated_fat_grams,total_fiber_grams",
    ...rows,
  ].join("\n");
}

/** Full-fidelity export — the CSV aggregates by day and cannot be re-imported. */
export async function exportRawJson(): Promise<string> {
  await ensureLoaded();
  const payload: LogFile = { version: 1, entries: [...entries] };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
