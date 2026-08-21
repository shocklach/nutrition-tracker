import { useState, useEffect, useCallback } from "react";
import type { Entry, LogFile, RepoConfig } from "../types";
import { clearConfig } from "../config";
import { importEntries, exportRawJson, refresh } from "../db";
import { readLegacyEntries, clearLegacyEntries } from "../legacyDb";
import { shareFile } from "../utils";

interface Props {
  config: RepoConfig;
  onBack: () => void;
  onReconfigure: () => void;
  onDisconnected: () => void;
  onDataChanged: () => void;
}

// Accepts either a full entries.json ({version, entries}) or a bare array, so a
// hand-edited or partial export still imports.
function parseImport(text: string): Entry[] {
  const parsed = JSON.parse(text) as Partial<LogFile> | Entry[];
  const list = Array.isArray(parsed) ? parsed : parsed.entries;
  if (!Array.isArray(list)) throw new Error("No entries found in that file.");

  for (const entry of list) {
    if (!entry || typeof entry.id !== "string" || typeof entry.dateKey !== "string") {
      throw new Error("That file does not look like a nutrition export.");
    }
  }
  return list as Entry[];
}

export default function Settings({
  config,
  onBack,
  onReconfigure,
  onDisconnected,
  onDataChanged,
}: Props) {
  const [legacyCount, setLegacyCount] = useState<number | null>(null);
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readLegacyEntries().then((list) => setLegacyCount(list.length));
  }, []);

  const runImport = useCallback(
    async (entries: Entry[], afterSuccess?: () => Promise<void>) => {
      setError("");
      setMessage("");
      setBusy(true);
      try {
        const { added, skipped } = await importEntries(entries);
        if (afterSuccess) await afterSuccess();
        setMessage(
          `Imported ${added} ${added === 1 ? "entry" : "entries"}` +
            (skipped ? `, skipped ${skipped} already in the log.` : ".")
        );
        onDataChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      } finally {
        setBusy(false);
      }
    },
    [onDataChanged]
  );

  const importFromThisDevice = async () => {
    const entries = await readLegacyEntries();
    if (entries.length === 0) {
      setError("Nothing left to import on this device.");
      return;
    }
    // Only cleared after the write succeeds, so a failed import is repeatable.
    await runImport(entries, async () => {
      await clearLegacyEntries();
      setLegacyCount(0);
    });
  };

  const importFromText = async () => {
    try {
      await runImport(parseImport(pasted));
      setPasted("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that JSON.");
    }
  };

  const importFromFile = async (file: File) => {
    try {
      await runImport(parseImport(await file.text()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const handleExport = async () => {
    await shareFile(await exportRawJson(), "nutrition-entries.json", "application/json");
  };

  const handleDisconnect = () => {
    clearConfig();
    onDisconnected();
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn-back" onClick={onBack}>
          &larr; Today
        </button>
        <h2>Settings</h2>
      </div>

      <section className="panel">
        <h3>Connection</h3>
        <p className="prose">
          Syncing with <code>{config.owner}/{config.repo}</code>.
        </p>
        <button className="btn-secondary" onClick={() => refresh().then(onDataChanged)}>
          Sync now
        </button>
        <button className="btn-secondary" onClick={onReconfigure}>
          Change repo or token
        </button>
      </section>

      <section className="panel">
        <h3>Bring in old history</h3>
        {legacyCount === null && <p className="prose">Checking this device…</p>}
        {legacyCount !== null && legacyCount > 0 && (
          <>
            <p className="prose">
              Found {legacyCount} {legacyCount === 1 ? "entry" : "entries"} saved in this
              browser from before syncing. Importing merges them into the shared log.
            </p>
            <button className="btn-primary" onClick={importFromThisDevice} disabled={busy}>
              {busy ? "Importing…" : `Import ${legacyCount} from this device`}
            </button>
          </>
        )}
        {legacyCount === 0 && (
          <p className="prose">
            No leftover local history on this device. To bring in another device's
            history, export it there and import the file below.
          </p>
        )}
      </section>

      <section className="panel">
        <h3>Import a file</h3>
        <p className="prose">
          Use the JSON export from your other device. Re-importing the same file is
          safe — entries already in the log are skipped.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importFromFile(file);
            e.target.value = "";
          }}
        />
        <textarea
          rows={4}
          placeholder="…or paste the JSON here"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button className="btn-secondary" onClick={importFromText} disabled={busy || !pasted.trim()}>
          Import pasted JSON
        </button>
      </section>

      <section className="panel">
        <h3>Export</h3>
        <p className="prose">
          Full export including every individual entry — unlike the CSV, this can be
          imported back.
        </p>
        <button className="btn-secondary" onClick={handleExport}>
          Export all entries (JSON)
        </button>
      </section>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h3>Disconnect</h3>
        <p className="prose">
          Removes the token from this device. Your log stays in the repo.
        </p>
        <button className="btn-secondary btn-danger-outline" onClick={handleDisconnect}>
          Disconnect this device
        </button>
      </section>
    </div>
  );
}
