import { useState, useEffect, useCallback } from "react";
import type { Entry } from "../types";
import { listEntriesByDateKey, deleteEntry, updateEntry } from "../db";
import { formatTime, formatDateKey, round1 } from "../utils";

interface Props {
  dateKey: string;
  onBack: () => void;
}

export default function DayDetail({ dateKey, onBack }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProtein, setEditProtein] = useState("");
  const [editCalories, setEditCalories] = useState("");
  const [editSaturatedFat, setEditSaturatedFat] = useState("");
  const [editFiber, setEditFiber] = useState("");
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
  const totalSaturatedFat = round1(entries.reduce((s, e) => s + (e.saturatedFatGrams ?? 0), 0));
  const totalFiber = round1(entries.reduce((s, e) => s + (e.fiberGrams ?? 0), 0));

  const startEdit = (e: Entry) => {
    setEditingId(e.id);
    setEditProtein(String(e.proteinGrams));
    setEditCalories(String(e.calories));
    setEditSaturatedFat(String(e.saturatedFatGrams ?? 0));
    setEditFiber(String(e.fiberGrams ?? 0));
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const saveEdit = async () => {
    setError("");
    const p = parseInt(editProtein, 10);
    const c = parseInt(editCalories, 10);
    const f = parseFloat(editSaturatedFat);
    const fib = parseFloat(editFiber);
    if (isNaN(p) || isNaN(c) || isNaN(f) || isNaN(fib)) {
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
    if (f < 0 || f > 200) {
      setError("Saturated fat must be 0-200g.");
      return;
    }
    if (fib < 0 || fib > 200) {
      setError("Fiber must be 0-200g.");
      return;
    }
    await updateEntry(editingId!, { proteinGrams: p, calories: c, saturatedFatGrams: f, fiberGrams: fib });
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    if (editingId === id) setEditingId(null);
    await load();
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn-back" onClick={onBack}>
          &larr; History
        </button>
        <h2>{formatDateKey(dateKey)}</h2>
      </div>

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

      <div className="entries-list">
        {entries.length === 0 && <p className="empty">No entries.</p>}
        {entries.map((e) => (
          <div key={e.id} className="entry-row">
            {editingId === e.id ? (
              <div className="edit-form">
                <div className="input-row">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editProtein}
                    onChange={(ev) => setEditProtein(ev.target.value)}
                    placeholder="Protein (g)"
                    min={0}
                    max={500}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editCalories}
                    onChange={(ev) => setEditCalories(ev.target.value)}
                    placeholder="Calories"
                    min={0}
                    max={5000}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={editSaturatedFat}
                    onChange={(ev) => setEditSaturatedFat(ev.target.value)}
                    placeholder="Sat. Fat (g)"
                    min={0}
                    max={200}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={editFiber}
                    onChange={(ev) => setEditFiber(ev.target.value)}
                    placeholder="Fiber (g)"
                    min={0}
                    max={200}
                  />
                </div>
                {error && <div className="error">{error}</div>}
                <div className="edit-actions">
                  <button className="btn-sm btn-primary" onClick={saveEdit}>
                    Save
                  </button>
                  <button className="btn-sm btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="entry-info">
                  <span className="entry-time">{formatTime(e.timestamp)}</span>
                  <span className="entry-macros">
                    {e.proteinGrams}g protein &middot; {e.calories} cal &middot; {round1(e.saturatedFatGrams ?? 0)}g sat. fat &middot; {round1(e.fiberGrams ?? 0)}g fiber
                  </span>
                </div>
                <div className="entry-actions">
                  <button className="btn-sm btn-secondary" onClick={() => startEdit(e)}>
                    Edit
                  </button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(e.id)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
