// Round to 1 decimal place to avoid floating-point noise when summing
// decimal entries (e.g. 0.1 + 0.2 = 0.30000000000000004).
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getRecentDateKeys(n: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${day}`);
  }
  return keys;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// On iOS this opens the native share sheet with the CSV as a shareable file,
// so it can be saved to Files / iCloud Drive or handed to a Shortcut in one tap.
// Falls back to a normal download on desktop or where file sharing is unsupported.
export async function shareCsv(csv: string, filename: string): Promise<void> {
  try {
    const file = new File([csv], filename, { type: "text/csv" });
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
  downloadCsv(csv, filename);
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
