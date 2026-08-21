import { useState, useEffect, useCallback } from "react";
import type { Entry } from "../types";
import { addEntry, listEntriesByDateKey, deleteEntry } from "../db";
import { formatTime, formatDateKey, newId, round1 } from "../utils";
import { parseMacros } from "../validation";
import EntryRow from "./EntryRow";

interface Props {
  dateKey: string;
  onGoHistory: () => void;
}

export default function Today({ dateKey, onGoHistory }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [protein, setProtein] = useState("");
  const [calories, setCalories] = useState("");
  const [saturatedFat, setSaturatedFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await listEntriesByDateKey(dateKey);
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setEntries(list);
  }, [dateKey]);

  useEffect(() => {
    load();
  }, [load]);

  const totalProtein = entries.reduce((s, e) => s + e.proteinGrams, 0);
  const totalCalories = entries.reduce((s, e) => s + e.calories, 0);
  const totalSaturatedFat = round1(entries.reduce((s, e) => s + (e.saturatedFatGrams ?? 0), 0));
  const totalFiber = round1(entries.reduce((s, e) => s + (e.fiberGrams ?? 0), 0));

  const handleSubmit = async () => {
    setError("");
    const result = parseMacros({ protein, calories, saturatedFat, fiber });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const entry: Entry = {
      id: newId(),
      timestamp: new Date().toISOString(),
      dateKey,
      ...result.macros,
      ...(note.trim() ? { note: note.trim() } : {}),
      source: "manual",
    };

    setBusy(true);
    try {
      await addEntry(entry);
      setProtein("");
      setCalories("");
      setSaturatedFat("");
      setFiber("");
      setNote("");
      await load();
    } catch (err) {
      // The write goes over the network now, so a failure has to be visible
      // rather than silently dropping the meal.
      setError(err instanceof Error ? err.message : "Could not save that entry.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteEntry(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that entry.");
    }
  };

  return (
    <div className="screen">
      <div className="date-label">{formatDateKey(dateKey)}</div>

      <div className="totals">
        <div className="total-card">
          <span className="total-value">{totalProtein}g</span>
          <span className="total-label">Protein</span>
        </div>
        <div className="total-card">
          <span className="total-value">{totalCalories}</span>
          <span className="total-label">Calories</span>
        </div>
        <div className="total-card">
          <span className="total-value">{totalSaturatedFat}g</span>
          <span className="total-label">Sat. Fat</span>
        </div>
        <div className="total-card">
          <span className="total-value">{totalFiber}g</span>
          <span className="total-label">Fiber</span>
        </div>
      </div>

      <div className="input-row">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Protein (g)"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          min={0}
          max={500}
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="Calories"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          min={0}
          max={5000}
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Sat. Fat (g)"
          value={saturatedFat}
          onChange={(e) => setSaturatedFat(e.target.value)}
          min={0}
          max={200}
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Fiber (g)"
          value={fiber}
          onChange={(e) => setFiber(e.target.value)}
          min={0}
          max={200}
        />
        <input
          className="input-full"
          type="text"
          placeholder="What was it? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
        {busy ? "Saving…" : "Add Entry"}
      </button>

      <div className="entries-list">
        <h3>Today's Entries</h3>
        {entries.length === 0 && (
          <p className="empty">No entries yet. Add your first meal!</p>
        )}
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} time={formatTime(e.timestamp)}>
            <button className="btn-sm btn-danger" onClick={() => handleDelete(e.id)}>
              Delete
            </button>
          </EntryRow>
        ))}
      </div>

      <button className="btn-secondary" onClick={onGoHistory}>
        View History
      </button>
    </div>
  );
}
