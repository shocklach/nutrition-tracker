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

This step needs you — GitHub Apps cannot create repositories, so the automation
in this session is blocked from doing it.

**Option A — one script** (needs the [GitHub CLI](https://cli.github.com)).
Creates the repo *and* pushes the files. The script lives in this repo, so
clone it first:

```bash
brew install gh          # if you do not have it
gh auth login

git clone -b claude/chatgpt-nutrition-tracker-fzbx4o \
  https://github.com/shocklach/nutrition-tracker.git
cd nutrition-tracker
./scripts/bootstrap-data-repo.sh
```

After this branch is merged to `main` you can drop the `-b ...` flag.

**Option B — in the browser.** Create a repo named **`nutrition-log`**, set it
to **Private**, and tick *Add a README* so it starts with a branch:

<https://github.com/new>

Then either run the script above, or tell Claude the repo exists and it will
push the files for you.

**Option C — by hand.** Copy the three files from `data-repo/` into the new
repo, keeping their paths:

```
entries.json
scripts/append-entry.mjs
.github/workflows/log-entry.yml
```

Whichever route: confirm the repo shows **Private**, and that Actions is
enabled under Settings → Actions → General → "Allow all actions".

## 2. Create two access tokens

This step also needs you — GitHub has no API for creating personal access
tokens, so it cannot be automated by anything, including Claude.

Go to: <https://github.com/settings/personal-access-tokens/new>

Create **two** tokens so either can be revoked without breaking the other.
Give both of them *identical* settings:

| Field | Value |
| --- | --- |
| Token name | `nutrition-app` (first) / `nutrition-gpt` (second) |
| Resource owner | `shocklach` |
| Expiration | your call — see the warning below |
| Repository access | **Only select repositories** → `nutrition-log` |
| Permissions → Repository → **Contents** | **Read and write** |

Leave every other permission alone. *Metadata: Read-only* is added
automatically and is required. `Contents: Read and write` is what allows both
the file writes and the `repository_dispatch` call the GPT makes — no other
permission is needed.

Copy each token immediately; GitHub shows it once.

> **On expiration:** if you set one, both the app and the GPT stop working that
> day, with a "Token rejected by GitHub" error in the app. Ninety days is a
> reasonable default; "No expiration" trades security for not having to think
> about it again. Your call, but know which you picked.

**Keep these two tokens separate.** Token 1 goes into the app on your devices.
Token 2 goes into the Custom GPT. Do not paste either into this chat — nothing
here needs them, and a token in a transcript is a token you should rotate.

## 3. Deploy the app

Merge this branch to `main`. The existing Pages workflow builds and deploys it.

## 4. Connect each device

Open the app on your phone, then on your computer. Each will show a **Connect
your log** screen. Enter:

- GitHub username — `shocklach`
- Private data repo — `nutrition-log`
- Token — number **1** (`nutrition-app`)

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

A Custom GPT requires ChatGPT Plus/Pro. The action only fires inside this GPT —
plain ChatGPT conversations cannot call it.

**Create it:** ChatGPT → sidebar **GPTs** → **+ Create** → **Configure** tab
(skip the chat-based builder; it is slower for this).

**Name:** something short you will pick out of a list — *Nutrition*.

**Instructions:** paste the whole block from
[`gpt-instructions.md`](gpt-instructions.md).

**Actions:** scroll to the bottom, **Create new action**.

1. **Authentication** (the gear at the top of the action editor):
   - Authentication Type → **API Key**
   - API Key → paste token **2** (`nutrition-gpt`)
   - Auth Type → **Bearer**
   - Save

2. **Schema:** paste the contents of
   [`chatgpt-action.json`](chatgpt-action.json). It already points at
   `shocklach/nutrition-log`.

   ChatGPT parses it immediately. You should see one available action,
   `logNutritionEntry`, appear underneath. If you instead see a red parse error,
   you likely pasted with a character mangled — repaste from the raw file.

3. **Privacy policy:** required only if you publish the GPT. Leave blank and
   keep the GPT private to yourself.

4. **Save** (top right) → **Only me**.

### Testing the action from the editor

The action row has a **Test** button. It will invent placeholder values and call
the endpoint. A successful call shows a `204` with an empty response — that is
the expected result, not an error. GitHub returns no body for a dispatch.

If the test writes a junk meal to your log, delete it in the app afterwards.

### If it fails

| What you see | Cause |
| --- | --- |
| `401 Bad credentials` | Token wrong, or Auth Type not set to **Bearer** |
| `403` | Token lacks **Contents: Read and write**, or is not scoped to `nutrition-log` |
| `404 Not Found` | Repo name wrong in the schema path, or the token cannot see the repo |
| `422` | `event_type` was not sent as `log-entry` |
| 204, but no Actions run | Workflow file not on the repo's **default branch**, or Actions disabled |

A 204 means GitHub accepted the dispatch, not that the entry was written —
check the repo's Actions tab to see the run itself succeed.

## 7. Test it end to end

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
