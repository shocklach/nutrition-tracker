// All day boundaries are computed in this zone rather than the device's, so a
// late dinner lands on the same day whether it is logged from the phone, the
// browser, or the GitHub Action (which runs in UTC). Keep this in sync with
// TIME_ZONE in the data repo's log-entry workflow.
export const APP_TIME_ZONE = "America/Chicago";

// Round to 1 decimal place to avoid floating-point noise when summing
// decimal entries (e.g. 0.1 + 0.2 = 0.30000000000000004).
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// "en-CA" formats as YYYY-MM-DD, which is exactly the dateKey shape.
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dateKeyFor(date: Date): string {
  return dateKeyFormatter.format(date);
}

export function getTodayDateKey(): string {
  return dateKeyFor(new Date());
}

// Calendar arithmetic on the key itself. Going through UTC keeps a DST
// transition from producing a duplicate or missing day.
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function getRecentDateKeys(n: number): string[] {
  const today = getTodayDateKey();
  const keys: string[] = [];
  for (let i = 0; i < n; i++) keys.push(addDaysToDateKey(today, -i));
  return keys;
}

const timeFormatter = new Intl.DateTimeFormat([], {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  // Built from parts, so this is a plain calendar date with no zone shift.
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function downloadFile(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// On iOS this opens the native share sheet with the file attached, so it can be
// saved to Files / iCloud Drive or handed to a Shortcut in one tap. Falls back
// to a normal download on desktop or where file sharing is unsupported.
export async function shareFile(
  text: string,
  filename: string,
  mime: string
): Promise<void> {
  try {
    const file = new File([text], filename, { type: mime });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
    };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (err) {
    // User cancelled the share sheet, or sharing failed — fall through to download.
    if (err instanceof DOMException && err.name === "AbortError") return;
  }
  downloadFile(text, filename, mime);
}

export function shareCsv(csv: string, filename: string): Promise<void> {
  return shareFile(csv, filename, "text/csv");
}

export function newId(): string {
  // crypto.randomUUID() requires HTTPS; fall back for plain HTTP (e.g. LAN access)
  if (typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // falls through
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// btoa/atob are byte-oriented, so notes containing non-ASCII (accents, emoji)
// have to round-trip through UTF-8 explicitly or the commit is corrupted.
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
