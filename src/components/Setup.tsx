import { useState } from "react";
import type { RepoConfig } from "../types";
import { saveConfig } from "../config";
import { verifyAccess } from "../github";

interface Props {
  initial?: RepoConfig | null;
  onConnected: () => void;
  onCancel?: () => void;
}

export default function Setup({ initial, onConnected, onCancel }: Props) {
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [repo, setRepo] = useState(initial?.repo ?? "");
  const [token, setToken] = useState(initial?.token ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    setError("");
    const trimmed: RepoConfig = {
      owner: owner.trim(),
      repo: repo.trim(),
      token: token.trim(),
    };
    if (!trimmed.owner || !trimmed.repo || !trimmed.token) {
      setError("Fill in all three fields.");
      return;
    }

    setBusy(true);
    try {
      await verifyAccess(trimmed);
      saveConfig(trimmed);
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach that repo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div className="screen-header">
        {onCancel && (
          <button className="btn-back" onClick={onCancel}>
            &larr; Back
          </button>
        )}
        <h2>Connect your log</h2>
      </div>

      <p className="prose">
        Entries live in a private GitHub repo so every device — and your Custom GPT —
        reads and writes the same history. Connect each device once.
      </p>

      <div className="field">
        <label htmlFor="owner">GitHub username</label>
        <input
          id="owner"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="your-username"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="repo">Private data repo</label>
        <input
          id="repo"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="nutrition-log"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="token">Fine-grained access token</label>
        <input
          id="token"
          type="password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="github_pat_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <span className="field-hint">
          Scope it to that one repo with Contents: Read and write. It is stored only on
          this device, and revoking it in GitHub settings cuts this device off.
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn-primary" onClick={handleConnect} disabled={busy}>
        {busy ? "Checking…" : "Connect"}
      </button>
    </div>
  );
}
