import { useState, useEffect, useCallback } from "react";
import type { RepoConfig, SyncState } from "./types";
import { getTodayDateKey } from "./utils";
import { loadConfig } from "./config";
import { getSyncState, subscribeSync, refresh } from "./db";
import Today from "./components/Today";
import History from "./components/History";
import DayDetail from "./components/DayDetail";
import Setup from "./components/Setup";
import Settings from "./components/Settings";

type Screen =
  | { name: "today" }
  | { name: "history" }
  | { name: "day-detail"; dateKey: string }
  | { name: "settings" }
  | { name: "setup" };

export default function App() {
  const [config, setConfig] = useState<RepoConfig | null>(loadConfig);
  const [screen, setScreen] = useState<Screen>({ name: "today" });
  const [dateKey, setDateKey] = useState(getTodayDateKey);
  const [sync, setSync] = useState<SyncState>(getSyncState);
  // Bumped to force the visible screen to re-read after a sync or import.
  const [dataVersion, setDataVersion] = useState(0);

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

  useEffect(() => subscribeSync(setSync), []);

  useEffect(() => {
    if (config) refresh().then(bumpData);
  }, [config, bumpData]);

  // Auto-roll at midnight, and pick up anything logged from ChatGPT or another
  // device while this tab was in the background.
  useEffect(() => {
    const check = () => {
      const today = getTodayDateKey();
      if (today !== dateKey) setDateKey(today);
    };
    const id = setInterval(check, 30_000);
    const onVisibility = () => {
      if (document.hidden) return;
      check();
      if (loadConfig()) refresh().then(bumpData);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dateKey, bumpData]);

  const goToday = useCallback(() => setScreen({ name: "today" }), []);
  const goHistory = useCallback(() => setScreen({ name: "history" }), []);
  const goSettings = useCallback(() => setScreen({ name: "settings" }), []);
  const goDetail = useCallback(
    (dk: string) => setScreen({ name: "day-detail", dateKey: dk }),
    []
  );

  const handleConnected = useCallback(() => {
    setConfig(loadConfig());
    setScreen({ name: "today" });
  }, []);

  if (!config || screen.name === "setup") {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Nutrition Tracker</h1>
        </header>
        <Setup
          initial={config}
          onConnected={handleConnected}
          onCancel={config ? goSettings : undefined}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={goToday}>Nutrition Tracker</h1>
        <button className="btn-gear" onClick={goSettings} aria-label="Settings">
          &#9881;
        </button>
      </header>

      {sync.status === "error" && (
        <div className="banner banner-error">
          <span>{sync.message}</span>
          <button className="btn-sm btn-secondary" onClick={() => refresh().then(bumpData)}>
            Retry
          </button>
        </div>
      )}
      {sync.status === "loading" && <div className="banner">Syncing…</div>}

      {screen.name === "today" && (
        <Today
          key={`today-${dataVersion}`}
          dateKey={dateKey}
          onGoHistory={goHistory}
        />
      )}
      {screen.name === "history" && (
        <History
          key={`history-${dataVersion}`}
          onGoToday={goToday}
          onSelectDay={goDetail}
        />
      )}
      {screen.name === "day-detail" && (
        <DayDetail
          key={`detail-${screen.dateKey}-${dataVersion}`}
          dateKey={screen.dateKey}
          onBack={goHistory}
        />
      )}
      {screen.name === "settings" && (
        <Settings
          config={config}
          onBack={goToday}
          onReconfigure={() => setScreen({ name: "setup" })}
          onDisconnected={() => {
            setConfig(null);
            setScreen({ name: "today" });
          }}
          onDataChanged={bumpData}
        />
      )}
    </div>
  );
}
