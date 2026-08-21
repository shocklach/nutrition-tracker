export interface Entry {
  id: string;
  timestamp: string; // ISO string
  dateKey: string; // YYYY-MM-DD in APP_TIME_ZONE
  proteinGrams: number; // integer, 0-500
  calories: number; // integer, 0-5000
  saturatedFatGrams: number; // decimals allowed (e.g. 0.5, 1.5), 0-200
  fiberGrams: number; // decimals allowed (e.g. 0.5, 1.5), 0-200
  note?: string; // what the meal was — mainly for entries logged via ChatGPT
  source?: EntrySource;
}

export type EntrySource = "manual" | "chatgpt";

export interface DaySummary {
  dateKey: string;
  totalProtein: number;
  totalCalories: number;
  totalSaturatedFat: number;
  totalFiber: number;
  entryCount: number;
}

// Shape of entries.json in the private data repo.
export interface LogFile {
  version: 1;
  entries: Entry[];
}

export interface RepoConfig {
  owner: string;
  repo: string;
  token: string;
}

// Reported to the UI so a failed write is visible rather than silent.
export type SyncState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "ready"; lastSyncedAt: string }
  | { status: "error"; message: string };
