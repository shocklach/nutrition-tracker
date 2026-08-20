import type { LogFile, RepoConfig } from "./types";
import { decodeBase64, encodeBase64 } from "./utils";

export const LOG_PATH = "entries.json";

const API_ROOT = "https://api.github.com";
const MAX_WRITE_ATTEMPTS = 4;

export class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GitHubError";
  }
}

function headers(config: RepoConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// GitHub's error bodies are far more useful than the bare status, but they are
// not guaranteed to be JSON — fall back to the status text.
async function describeFailure(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    detail = body.message ?? "";
  } catch {
    detail = "";
  }
  if (res.status === 401) return "Token rejected by GitHub. It may be expired or mistyped.";
  if (res.status === 403) return detail || "Token lacks Contents write permission on this repo.";
  if (res.status === 404) {
    return "Repo or file not found. Check the owner/repo, and that the token grants access to it.";
  }
  return detail ? `GitHub: ${detail}` : `GitHub returned ${res.status} ${res.statusText}`;
}

const EMPTY_LOG: LogFile = { version: 1, entries: [] };

export interface LoadedLog {
  log: LogFile;
  /** null when the file does not exist yet — the first write creates it. */
  sha: string | null;
}

function parseLog(text: string): LogFile {
  const parsed = JSON.parse(text) as Partial<LogFile>;
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error("entries.json is not in the expected format.");
  }
  return { version: 1, entries: parsed.entries };
}

export async function readLog(config: RepoConfig): Promise<LoadedLog> {
  const url = `${API_ROOT}/repos/${config.owner}/${config.repo}/contents/${LOG_PATH}`;
  // no-store so a stale cached copy can never be the base of a write.
  const res = await fetch(url, { headers: headers(config), cache: "no-store" });

  if (res.status === 404) return { log: { ...EMPTY_LOG }, sha: null };
  if (!res.ok) throw new GitHubError(await describeFailure(res), res.status);

  const body = (await res.json()) as { content?: string; sha: string; encoding?: string };

  // Files over 1MB come back with an empty content field; the blob API still
  // serves them. At ~150 bytes per entry that is several years of logging.
  if (!body.content && body.sha) {
    const blobRes = await fetch(
      `${API_ROOT}/repos/${config.owner}/${config.repo}/git/blobs/${body.sha}`,
      { headers: headers(config), cache: "no-store" }
    );
    if (!blobRes.ok) throw new GitHubError(await describeFailure(blobRes), blobRes.status);
    const blob = (await blobRes.json()) as { content: string };
    return { log: parseLog(decodeBase64(blob.content)), sha: body.sha };
  }

  return { log: parseLog(decodeBase64(body.content ?? "")), sha: body.sha };
}

async function writeLog(
  config: RepoConfig,
  log: LogFile,
  sha: string | null,
  message: string
): Promise<string> {
  const url = `${API_ROOT}/repos/${config.owner}/${config.repo}/contents/${LOG_PATH}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: encodeBase64(`${JSON.stringify(log, null, 2)}\n`),
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) throw new GitHubError(await describeFailure(res), res.status);
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

function isConflict(err: unknown): boolean {
  // 409 is the documented sha-mismatch code; 422 shows up when the file was
  // created by another writer between our read and our write.
  return err instanceof GitHubError && (err.status === 409 || err.status === 422);
}

/**
 * Read-modify-write against entries.json.
 *
 * The GitHub Action that ChatGPT triggers commits to the same file, so a write
 * from the app can land on a stale sha. Re-read and replay the mutation rather
 * than clobbering, so a meal logged from ChatGPT mid-edit is never lost.
 */
export async function mutateLog(
  config: RepoConfig,
  message: string,
  mutate: (log: LogFile) => LogFile
): Promise<LogFile> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const { log, sha } = await readLog(config);
    const next = mutate(log);
    try {
      await writeLog(config, next, sha, message);
      return next;
    } catch (err) {
      if (!isConflict(err)) throw err;
      lastError = err;
      // Brief backoff so a burst of writes does not livelock on each other.
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not write to the log after several attempts.");
}

/** Used by the setup screen to give a clear pass/fail before saving config. */
export async function verifyAccess(config: RepoConfig): Promise<void> {
  const res = await fetch(`${API_ROOT}/repos/${config.owner}/${config.repo}`, {
    headers: headers(config),
    cache: "no-store",
  });
  if (!res.ok) throw new GitHubError(await describeFailure(res), res.status);
  const repo = (await res.json()) as { private: boolean; permissions?: { push?: boolean } };
  if (!repo.private) {
    throw new Error(
      "That repo is public. Use a private repo — a public one would publish your log."
    );
  }
  if (repo.permissions && repo.permissions.push === false) {
    throw new Error("Token can read this repo but not write to it. Grant Contents: Read and write.");
  }
}
