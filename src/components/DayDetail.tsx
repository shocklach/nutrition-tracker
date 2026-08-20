import { useState, useEffect, useCallback } from "react";
import type { Entry } from "../types";
import { listEntriesByDateKey, deleteEntry, updateEntry } from "../db";
import { formatTime, formatDateKey, round1 } from "../utils";
import { parseMacros } from "../validation";
import EntryRow from "./EntryRow";

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
  const [editNote, setEditNote] = useState("");
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

  const startEdit = (e: Entry) => {
    setEditingId(e.id);
    setEditProtein(String(e.proteinGrams));
    setEditCalories(String(e.calories));
    setEditSaturatedFat(String(e.saturatedFatGrams ?? 0));
    setEditFiber(String(e.fiberGrams ?? 0));
    setEditNote(e.note ?? "");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const saveEdit = async () => {
    setError("");
    const result = parseMacros({
      protein: editProtein,
      calories: editCalories,
      saturatedFat: editSaturatedFat,
      fiber: editFiber,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBusy(true);
    try {
      await updateEntry(editingId!, { ...result.macros, note: editNote.trim() || undefined });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that change.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteEntry(id);
      if (editingId === id) setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that entry.");
    }
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
        {entries.map((e) =>
          editingId === e.id ? (
            <div key={e.id} className="entry-row">
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
                  <input
                    className="input-full"
                    type="text"
                    value={editNote}
                    onChange={(ev) => setEditNote(ev.target.value)}
                    placeholder="What was it? (optional)"
                  />
                </div>
                {error && <div className="error">{error}</div>}
                <div className="edit-actions">
                  <button className="btn-sm btn-primary" onClick={saveEdit} disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button className="btn-sm btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <EntryRow key={e.id} entry={e} time={formatTime(e.timestamp)}>
              <button className="btn-sm btn-secondary" onClick={() => startEdit(e)}>
                Edit
              </button>
              <button className="btn-sm btn-danger" onClick={() => handleDelete(e.id)}>
                Delete
              </button>
            </EntryRow>
          )
        )}
      </div>
      {error && !editingId && <div className="error">{error}</div>}
    </div>
  );
}
