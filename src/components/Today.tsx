import { useState, useEffect, useCallback } from "react";
import type { Entry } from "../types";
import { addEntry, listEntriesByDateKey, deleteEntry } from "../db";
import { formatTime, formatDateKey, newId } from "../utils";

interface Props {
  dateKey: string;
  onGoHistory: () => void;
}

export default function Today({ dateKey, onGoHistory }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [protein, setProtein] = useState("");
  const [calories, setCalories] = useState("");
  const [error, setError] = useState("");

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

  const handleSubmit = async () => {
    setError("");
    const p = parseInt(protein, 10);
    const c = parseInt(calories, 10);

    if (isNaN(p) || isNaN(c)) {
      setError("Enter valid numbers.");
      return;
    }
    if (p < 0 || p > 500) {
      setError("Protein must be 0-500g.");
      return;
    }
    if (c < 0 || c > 5000) {
      setError("Calories must be 0-5000.");
      return;
    }

    const entry: Entry = {
      id: newId(),
      timestamp: new Date().toISOString(),
      dateKey,
      proteinGrams: p,
      calories: c,
    };

    await addEntry(entry);
    setProtein("");
    setCalories("");
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    await load();
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
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn-primary" onClick={handleSubmit}>
        Add Entry
      </button>

      <div className="entries-list">
        <h3>Today's Entries</h3>
        {entries.length === 0 && (
          <p className="empty">No entries yet. Add your first meal!</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="entry-row">
            <div className="entry-info">
              <span className="entry-time">{formatTime(e.timestamp)}</span>
              <span className="entry-macros">
                {e.proteinGrams}g &middot; {e.calories} cal
              </span>
            </div>
            <button className="btn-sm btn-danger" onClick={() => handleDelete(e.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <button className="btn-secondary" onClick={onGoHistory}>
        View History
      </button>
    </div>
  );
}
