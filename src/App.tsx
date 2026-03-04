import { useState, useEffect, useCallback } from "react";
import { getTodayDateKey } from "./utils";
import Today from "./components/Today";
import History from "./components/History";
import DayDetail from "./components/DayDetail";

type Screen =
  | { name: "today" }
  | { name: "history" }
  | { name: "day-detail"; dateKey: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "today" });
  const [dateKey, setDateKey] = useState(getTodayDateKey);

  // Auto-roll at midnight: check every 30s
  useEffect(() => {
    const check = () => {
      const today = getTodayDateKey();
      if (today !== dateKey) setDateKey(today);
    };
    const id = setInterval(check, 30_000);
    // Also check on visibility change (user returns to tab)
    const onVisibility = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dateKey]);

  const goToday = useCallback(() => setScreen({ name: "today" }), []);
  const goHistory = useCallback(() => setScreen({ name: "history" }), []);
  const goDetail = useCallback(
    (dk: string) => setScreen({ name: "day-detail", dateKey: dk }),
    []
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={goToday}>Nutrition Tracker</h1>
      </header>

      {screen.name === "today" && (
        <Today dateKey={dateKey} onGoHistory={goHistory} />
      )}
      {screen.name === "history" && (
        <History onGoToday={goToday} onSelectDay={goDetail} />
      )}
      {screen.name === "day-detail" && (
        <DayDetail dateKey={screen.dateKey} onBack={goHistory} />
      )}
    </div>
  );
}
