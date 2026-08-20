import type { RepoConfig } from "./types";

const CONFIG_KEY = "nutrition-tracker.repo-config";

// The token lives in localStorage on each device. It is a fine-grained PAT
// scoped to contents on the single private data repo, so the blast radius if a
// device is compromised is this log and nothing else. Revoke it in GitHub
// settings to cut a device off.
export function loadConfig(): RepoConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RepoConfig>;
    if (!parsed.owner || !parsed.repo || !parsed.token) return null;
    return { owner: parsed.owner, repo: parsed.repo, token: parsed.token };
  } catch {
    return null;
  }
}

export function saveConfig(config: RepoConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}
