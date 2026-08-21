# Handoff — nutrition tracker + ChatGPT logging

Written for an AI coding agent picking this up mid-project. The backend is
built, deployed, and verified working end to end. **One task remains: creating
the Custom GPT.** Read "What is left" and "Known limits" before starting.

Everything below is verified fact, not plan. Where something is unverified it
says so.

---

## What this system does

The user estimates a meal's nutrition by asking ChatGPT, then wants to say
"log it" and have the entry appear in their personal nutrition tracker app —
on their phone and their laptop, same history.

Previously the app stored entries in per-browser IndexedDB, so every device had
a separate history and nothing external could write to it. That is now fixed.

## Architecture

```
                    ┌──────────────────────────────┐
  Custom GPT ──────▶│  POST /repos/.../dispatches  │
  ("log it")        │  then GET matching run status│
                    └──────────────┬───────────────┘
                                   │ triggers
                                   ▼
                    ┌──────────────────────────────┐
                    │  GitHub Action: log-entry    │
                    │  validates → appends → commit│
                    └──────────────┬───────────────┘
                                   ▼
   ┌───────────────────────────────────────────────────────┐
   │   shocklach/nutrition-log  (PRIVATE)  entries.json    │
   └───────────────────────────────────────────────────────┘
                                   ▲
                                   │ GitHub Contents API
                                   │ (read + read-modify-write)
                    ┌──────────────┴───────────────┐
                    │  The web app, in the browser │
                    │  token in localStorage       │
                    └──────────────────────────────┘
```

Two writers share one JSON file. Both handle write conflicts:

- **The app** retries on a stale-SHA 409, re-reading and replaying its mutation.
- **The workflow** re-applies its append onto the current file before pushing,
  retrying up to 5 times.

This was tested with a simulated race (the GPT committing between the app's
read and its write). Neither writer clobbers the other.

## Concrete facts

| Thing | Value |
| --- | --- |
| GitHub user | `shocklach` |
| App repo | `shocklach/nutrition-tracker` — **public**, default branch `main` |
| Live app | https://shocklach.github.io/nutrition-tracker/ |
| Data repo | `shocklach/nutrition-log` — **private**, default branch **`embrace`** |
| Data file | `entries.json` at the data repo root |
| Dispatch endpoint | `POST https://api.github.com/repos/shocklach/nutrition-log/dispatches` |
| Dispatch event type | `log-entry` |
| Time zone | `America/Chicago`, hardcoded in two places (see gotchas) |
| Required token permissions | Both tokens: Contents: Read and write on `nutrition-log`; `nutrition-gpt` additionally requires Actions: Read-only for commit confirmation |

**The data repo's default branch is `embrace`, not `main`.** The user's GitHub
account has a custom default-branch-name setting. All existing code reads the
default branch dynamically, so nothing is hardcoded — but do not assume `main`
when writing anything new that touches this repo.

## Status

### Done and verified

- [x] Data repo created, private, seeded with `entries.json`
- [x] `log-entry` workflow deployed and **proven working** — a dispatched run
      validated its payload, resolved the Central-time date, appended, and
      committed (`entries.json` currently holds that test entry, noted
      "Backend test - safe to delete")
- [x] App rewritten off IndexedDB onto the GitHub Contents API
- [x] Setup screen, sync status, error surfacing
- [x] Migration UI — imports legacy IndexedDB entries per device, merges by id
      and by content fingerprint, safe to re-run
- [x] Central-time date handling, verified across both DST transitions
- [x] `tsc` and `vite build` clean; browser smoke tests pass (13 assertions),
      conflict-retry test passes (8), migration test passes (9)
- [x] Merged to `main`, deployed — Pages run #5 succeeded on commit `3f38de6`
- [x] Both tokens created by the user
- [x] App connected on the user's **phone**

### Not done

- [ ] App connected on the user's **laptop** (30 seconds, user action)
- [ ] Old history imported — status unknown, ask the user. Gear icon →
      "Bring in old history" on each device that has pre-sync entries.
- [ ] Add Actions: Read-only to the existing `nutrition-gpt` token
- [ ] **The Custom GPT** ← the actual remaining work
- [ ] Delete the test entry once the user has seen it in the app

---

## What is left: the Custom GPT

### Materials, already prepared

- **`docs/chatgpt-action.json`** — OpenAPI 3.1 schema for the Action. Already
  points at `shocklach/nutrition-log`. Paste as-is; no edits needed.
- **`docs/gpt-instructions.md`** — the GPT's system instructions, including the
  "log it" trigger phrase and rules preventing it from logging meals the user
  was only asking about.

### Configuration

1. ChatGPT on the web → **GPTs** → **My GPTs** → choose an existing private
   GPT that is still editable → **Edit GPT**.
2. Name it something short, e.g. *Nutrition*.
3. **Instructions** ← the block from `docs/gpt-instructions.md`.
4. **Actions** → *Create new action*:
   - **Authentication**: API Key, Auth Type **Bearer**, value = the
     `nutrition-gpt` token. **Bearer, not Basic** — this is the single most
     common misconfiguration.
   - **Schema**: paste `docs/chatgpt-action.json`.
   - Two actions, `logNutritionEntry` and `checkNutritionLogStatus`, should
     appear below the schema box.
5. Privacy policy: only required to publish. Leave blank, save as **Only me**.

### Payload contract

```json
{
  "event_type": "log-entry",
  "client_payload": {
    "entryId": "meal-20260821-184500-a1b2c3",
    "proteinGrams": 42,
    "calories": 610,
    "saturatedFatGrams": 6.5,
    "fiberGrams": 9.2,
    "note": "Chicken burrito bowl",
    "dateKey": "2026-08-21"
  }
}
```

- `entryId` is required, reused across retries, and becomes the stored entry
  ID plus the workflow run name used for confirmation.
- `proteinGrams` (0–500) and `calories` (0–5000) are rounded to integers.
- `saturatedFatGrams` and `fiberGrams` (0–200) keep one decimal.
- Strings are coerced to numbers — `"6.5"` works. GPTs often send strings.
- `note` is optional, trimmed, truncated to 200 chars.
- `dateKey` is optional and **should normally be omitted** — the workflow stamps
  today's date in US Central. Only send it to backdate a meal.
- Anything out of range, missing, or malformed is rejected with a non-zero exit
  and no commit.

---

## Known limits — read before promising the user anything

**A Custom GPT cannot be created or configured programmatically.** On a
personal ChatGPT account, new GPT creation may be unavailable; use an existing
private GPT if its editor still allows Actions. Configuration remains a web UI
flow in the user's own OpenAI account. If you cannot drive a browser session
logged into that account, say so plainly rather than attempting workarounds.

**Do not ask the user to paste either token into a chat.** They are
non-expiring and scoped to write the data repo. Neither token needs to pass
through an agent: one lives in the browser's localStorage, the other in
ChatGPT's action config. The backend can be verified without them — see below.

If the Custom GPT route proves unworkable, viable alternatives that reach the
same endpoint: an iOS Shortcut that POSTs the dispatch; a ChatGPT connector /
remote MCP server; or the manual workflow trigger described below.

---

## How to verify things without any credentials

The workflow accepts `workflow_dispatch` as well as `repository_dispatch`, so
the exact append-and-commit path can be exercised from the Actions tab or the
API without a token of the user's:

https://github.com/shocklach/nutrition-log/actions/workflows/log-entry.yml
→ **Run workflow** → fill in numbers → Run.

Then confirm `entries.json` gained an entry. Commit messages name their
trigger: `Log meal (repository_dispatch)` vs `Log meal (workflow_dispatch)`.

This doubles as a user-facing feature: a browser fallback for logging a meal
when ChatGPT is unavailable.

To test the *token* specifically, the user runs this themselves — it never
enters an agent's context:

```bash
printf 'Paste nutrition-gpt token: '; read -rs TOKEN; echo
curl -sS -X POST https://api.github.com/repos/shocklach/nutrition-log/dispatches -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" -d '{"event_type":"log-entry","client_payload":{"entryId":"meal-token-test-0001","proteinGrams":42,"calories":610,"saturatedFatGrams":6.5,"fiberGrams":9.2,"note":"token test"}}' -w '\nHTTP %{http_code}\n'
unset TOKEN
```

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `401 Bad credentials` | Token wrong, or Auth Type is not **Bearer** |
| `403` | Token lacks Contents: Read and write, or is not scoped to `nutrition-log` |
| `403` from status check | `nutrition-gpt` lacks Actions: Read-only |
| `404 Not Found` | Wrong repo in the schema path, or token cannot see the repo |
| `422` | `event_type` was not the literal string `log-entry` |
| `204` but no Actions run | Workflow not on the default branch (`embrace`), or Actions disabled |
| GPT logs meals unprompted | Instructions were not pasted, or were edited to drop the explicit-request rule |
| App shows "Token rejected by GitHub" | The `nutrition-app` token was revoked or mistyped |
| Entry lands on the wrong day | Time zone drift — check both constants below |

**`204 No Content` with an empty body is dispatch acceptance, not logging
confirmation.** The GPT must query recent runs, find `Log entry <entryId>`, and
say "Logged" only after that matching run is completed with conclusion
`success`.

## Do not do these

- **Do not move `entries.json` into the app repo.** It is public, and GitHub
  Pages sites are publicly readable even when their repo is private. This is
  why the split exists.
- **Do not hardcode `main` for the data repo.** Its default branch is `embrace`.
- **Do not change one time zone constant without the other.** They must match:
  `APP_TIME_ZONE` in `src/utils.ts`, `TIME_ZONE` in
  `data-repo/scripts/append-entry.mjs`. A mismatch silently files meals on the
  wrong day near midnight.
- **Do not interpolate `client_payload` into a shell command** in the workflow.
  It is attacker-controllable text; it is passed via the environment for that
  reason.
- **Do not skip validation** in `append-entry.mjs` to make something work. It is
  the only thing standing between a malformed GPT payload and the data file.

## Repo layout

```
nutrition-tracker/                 (public, deployed to Pages)
├── src/
│   ├── github.ts                  Contents API client, sha-based concurrency
│   ├── db.ts                      data layer; same signatures as the old one
│   ├── legacyDb.ts                read-only IndexedDB, for migration
│   ├── config.ts                  repo + token in localStorage
│   ├── validation.ts              shared macro bounds (mirrors the workflow)
│   ├── utils.ts                   APP_TIME_ZONE lives here
│   └── components/
│       ├── Setup.tsx              connect-a-device screen
│       ├── Settings.tsx           migration, import/export, disconnect
│       └── EntryRow.tsx           shared entry rendering
├── data-repo/                     template copied into the private repo
│   ├── entries.json
│   ├── scripts/append-entry.mjs   TIME_ZONE lives here
│   └── .github/workflows/log-entry.yml
├── scripts/bootstrap-data-repo.sh idempotent data-repo setup
└── docs/
    ├── SETUP.md                   full setup walkthrough
    ├── chatgpt-action.json        paste into the GPT Action
    ├── gpt-instructions.md        paste into the GPT Instructions
    └── HANDOFF.md                 this file
```

`data-repo/` is a template. Editing it does **not** update the live private
repo — re-run `./scripts/bootstrap-data-repo.sh` (needs `gh`, idempotent) or
push the file directly.

## Design decisions worth not re-litigating

- **Why GitHub instead of Supabase/Vercel:** the user has accounts with both,
  tied to an unrelated project, and did not want them entangled. GitHub was
  already hosting the app.
- **Why a second repo instead of making the app repo private:** Pages on a
  private repo needs GitHub Pro (~$4/mo), and the Pages *site* is public
  regardless, so data in the build would be exposed. The split is free and
  actually private.
- **Why the app reads at runtime instead of baking data into the build:** same
  privacy reason, and it removes the 30–60s Pages rebuild from every read.
- **Why `repository_dispatch` instead of the GPT writing the file directly:**
  the Contents API needs a read-modify-write with base64 of the whole file.
  Asking a GPT to do that is fragile and degrades as history grows. One flat
  POST is a much better fit for an Action.
- **Why the GPT also reads workflow status:** `repository_dispatch` returns
  before the workflow finishes. Polling the matching run keeps the system
  GitHub-only while making "Logged" mean the append-and-commit job succeeded.
