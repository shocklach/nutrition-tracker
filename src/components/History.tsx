import { useState, useEffect } from "react";
import type { DaySummary } from "../types";
import { listRecentDays, exportCsv } from "../db";
import { formatDateKey, getRecentDateKeys, downloadCsv } from "../utils";

interface Props {
  onGoToday: () => void;
  onSelectDay: (dateKey: string) => void;
}

export default function History({ onGoToday, onSelectDay }: Props) {
  const [days, setDays] = useState<DaySummary[]>([]);

  useEffect(() => {
    listRecentDays(7).then(setDays);
  }, []);

  const handleExport7 = async () => {
    const keys = getRecentDateKeys(7);
    const csv = await exportCsv(keys);
    downloadCsv(csv, "nutrition-7days.csv");
  };

  const handleExportAll = async () => {
    const csv = await exportCsv();
    downloadCsv(csv, "nutrition-all.csv");
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn-back" onClick={onGoToday}>
          &larr; Today
        </button>
        <h2>History</h2>
      </div>

      {days.length === 0 && <p className="empty">No data yet.</p>}

      <div className="history-list">
        {days.map((d) => (
          <div
            key={d.dateKey}
            className="history-row"
            onClick={() => onSelectDay(d.dateKey)}
          >
            <span className="history-date">{formatDateKey(d.dateKey)}</span>
            <span className="history-stats">
              {d.totalProtein}g &middot; {d.totalCalories} cal &middot; {d.totalSaturatedFat}g sat. fat
            </span>
            <span className="history-chevron">&rsaquo;</span>
          </div>
        ))}
      </div>

      <div className="export-buttons">
        <button className="btn-secondary" onClick={handleExport7}>
          Export Last 7 Days (CSV)
        </button>
        <button className="btn-secondary" onClick={handleExportAll}>
          Export All Time (CSV)
        </button>
      </div>
    </div>
  );
}
