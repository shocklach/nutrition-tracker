# Setup

One-time setup to move the tracker off per-browser storage and let a Custom GPT
log meals into it.

**How it fits together:** entries live as `entries.json` in a *separate private*
repo. The app reads and writes that file directly over the GitHub API using a
token you enter once per device. ChatGPT triggers a GitHub Action in the same
repo, which appends to the same file. Every device and the GPT therefore share
one history.

This app's repo stays **public** — it holds no data, only code. That keeps
GitHub Pages free. Do not move `entries.json` into this repo: Pages sites are
publicly readable even when their repo is private, so the log would be exposed.

---

## 1. Create the private data repo

Create a new repo — suggested name **`nutrition-log`** — and make it
**Private**. Do not initialize it with anything.

Copy in the three files from this repo's `data-repo/` directory, keeping the
paths:

```
entries.json
scripts/append-entry.mjs
.github/workflows/log-entry.yml
```

Easiest route from your machine:

```bash
git clone https://github.com/YOUR_USERNAME/nutrition-log.git
cd nutrition-log
cp -r /path/to/nutrition-tracker/data-repo/. .
git add .
git commit -m "Set up nutrition log storage"
git push
```

Confirm on GitHub that the repo shows **Private** and that
**Actions** is enabled (Settings → Actions → General → "Allow all actions").

## 2. Create two access tokens

GitHub → Settings → Developer settings → **Fine-grained personal access
tokens** → Generate new token.

Make **two** separate tokens so you can revoke one without breaking the other:

| Token | Used by | Name it |
| --- | --- | --- |
| 1 | the app on your devices | `nutrition-app` |
| 2 | your Custom GPT | `nutrition-gpt` |

Both get identical settings:

- **Repository access** → Only select repositories → `nutrition-log`
- **Permissions** → Repository permissions → **Contents: Read and write**
  (Metadata: Read-only is added automatically and is required)
- **Expiration** → your call. If you set one, both the app and the GPT will
  start failing on that date and will need new tokens.

Copy each token when shown — GitHub will not display it again.

> `Contents: Read and write` is what allows both file writes *and* the
> `repository_dispatch` call the GPT makes. No other permission is needed.

## 3. Deploy the app

Merge this branch to `main`. The existing Pages workflow builds and deploys it.

## 4. Connect each device

Open the app on your phone, then on your computer. Each will show a **Connect
your log** screen. Enter:

- GitHub username
- `nutrition-log`
- token **1** (`nutrition-app`)

The app checks the token and refuses to connect to a public repo.

## 5. Bring your old history across

Your existing entries are in each browser's local storage and have to be merged
in once.

**On each device that has history:** open the gear icon → **Bring in old
history** → *Import N from this device*. That merges that browser's entries into
the shared log and clears the local copy so it cannot be double-imported.

If a device can't reach the app any more but you still have its data, use
**Export all entries (JSON)** there and **Import a file** on a connected device.
Importing the same file twice is safe — entries already present are skipped, by
id and by an exact timestamp-and-values match.

Do the phone and the computer one at a time, and confirm the count after each.

## 6. Create the Custom GPT

ChatGPT → Explore GPTs → **Create**.

1. **Configure** tab → give it a name, e.g. *Nutrition*.
2. **Instructions** → paste the block from [`gpt-instructions.md`](gpt-instructions.md).
3. **Actions** → *Create new action*.
   - **Schema** → paste [`chatgpt-action.json`](chatgpt-action.json), then
     replace `OWNER` and `REPO` in the path with your username and
     `nutrition-log`.
   - **Authentication** → *API Key*, Auth Type **Bearer**, and paste token
     **2** (`nutrition-gpt`).
4. Save.

## 7. Test it

In the GPT: *"I had a chicken burrito bowl with rice, black beans, cheese, and
guac."* Then: *"log it."*

Check that:
- GitHub → `nutrition-log` → Actions shows a **Log entry** run that succeeds
- `entries.json` has a new record
- the app shows the meal (it re-syncs when you switch back to it; the gear menu
  has **Sync now**)

Typical delay between "log it" and the commit is 10–30 seconds — the Action has
to spin up a runner.

---

## Notes and limits

**Where the tokens live.** The app token sits in `localStorage` on each device.
This app renders no user-supplied HTML, so the XSS surface is small, but treat
it as you would a saved password: revoke it in GitHub settings if a device is
lost, and re-connect with a fresh token.

**Both writers, one file.** The app and the Action both write `entries.json`.
Both use optimistic concurrency — the app retries on a stale-SHA conflict, and
the workflow re-applies its append onto the current file before pushing. A meal
logged from ChatGPT while you're editing on the phone will not be lost.

**Actions minutes.** Private repos get 2,000 free Actions minutes a month. Each
log run is well under a minute, so a few meals a day is nowhere near the cap.

**Offline.** The app keeps a local cache of the last sync, so it will still
render your history without a connection, but adding or editing entries needs
network — a failed write shows an error rather than silently dropping the meal.

**Dates.** Day boundaries are computed in `America/Chicago` everywhere: in the
app (`APP_TIME_ZONE` in `src/utils.ts`) and in the workflow (`TIME_ZONE` in
`data-repo/scripts/append-entry.mjs`). A 9pm dinner files under that day, not
the next. If you move time zones, change both.

**File size.** The app reads `entries.json` through the Contents API, which
serves files up to 1MB inline and falls back to the blob API above that. At
roughly 150 bytes per entry that is many years of logging.
