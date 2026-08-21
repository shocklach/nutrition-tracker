// Appends one entry to entries.json from a repository_dispatch payload.
//
// Runs inside the data repo's Action. The payload comes from a Custom GPT and
// is therefore untrusted input: every field is validated and coerced here, and
// nothing from it is ever interpolated into a shell command.

import { readFile, writeFile } from "node:fs/promises";

// Must match APP_TIME_ZONE in the app's src/utils.ts. The runner is UTC, so
// without this a 7pm Central dinner would be filed under the next day.
const TIME_ZONE = "America/Chicago";
const LOG_PATH = process.env.LOG_PATH ?? "entries.json";

const BOUNDS = {
  proteinGrams: { min: 0, max: 500, integer: true },
  calories: { min: 0, max: 5000, integer: true },
  saturatedFatGrams: { min: 0, max: 200, integer: false },
  fiberGrams: { min: 0, max: 200, integer: false },
};

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fail(message) {
  console.error(`Rejected: ${message}`);
  process.exit(1);
}

function requireNumber(payload, field) {
  const bound = BOUNDS[field];
  const raw = payload[field];
  const value = typeof raw === "string" ? Number(raw) : raw;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${field} is missing or not a number.`);
  }
  if (value < bound.min || value > bound.max) {
    fail(`${field} must be between ${bound.min} and ${bound.max} (got ${value}).`);
  }
  // Protein and calories are whole numbers; fat and fiber keep one decimal.
  return bound.integer ? Math.round(value) : Math.round(value * 10) / 10;
}

function requireEntryId(payload) {
  const value = process.env.ENTRY_ID || payload.entryId;
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(value)
  ) {
    fail("entryId must be 8-64 letters, numbers, hyphens, or underscores.");
  }
  return value;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveDateKey(payload) {
  const supplied = payload.dateKey;
  if (typeof supplied === "string" && isValidDateKey(supplied)) {
    return supplied;
  }
  if (supplied !== undefined && supplied !== null && supplied !== "") {
    fail(`dateKey must be YYYY-MM-DD (got ${JSON.stringify(supplied)}).`);
  }
  return dateKeyFormatter.format(new Date());
}

function readPayload() {
  const raw = process.env.PAYLOAD;
  if (!raw) fail("No PAYLOAD provided.");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail("PAYLOAD is not an object.");
    }
    return parsed;
  } catch (err) {
    fail(`PAYLOAD is not valid JSON: ${err.message}`);
  }
}

async function readLog() {
  try {
    const parsed = JSON.parse(await readFile(LOG_PATH, "utf8"));
    if (!Array.isArray(parsed.entries)) fail(`${LOG_PATH} has no entries array.`);
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, entries: [] };
    throw err;
  }
}

const payload = readPayload();

const entry = {
  // Supplied by the client and reused across Action retries and workflow runs.
  id: requireEntryId(payload),
  timestamp: new Date().toISOString(),
  dateKey: resolveDateKey(payload),
  proteinGrams: requireNumber(payload, "proteinGrams"),
  calories: requireNumber(payload, "calories"),
  saturatedFatGrams: requireNumber(payload, "saturatedFatGrams"),
  fiberGrams: requireNumber(payload, "fiberGrams"),
  source: "chatgpt",
};

if (typeof payload.note === "string" && payload.note.trim()) {
  entry.note = payload.note.trim().slice(0, 200);
}

const log = await readLog();

if (log.entries.some((e) => e.id === entry.id)) {
  console.log(`Entry ${entry.id} already logged; nothing to do.`);
  process.exit(0);
}

log.entries.push(entry);
await writeFile(LOG_PATH, `${JSON.stringify(log, null, 2)}\n`);

console.log(
  `Logged ${entry.dateKey}: ${entry.proteinGrams}g protein, ${entry.calories} cal, ` +
    `${entry.saturatedFatGrams}g sat fat, ${entry.fiberGrams}g fiber` +
    (entry.note ? ` — ${entry.note}` : "")
);
