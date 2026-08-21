# Nutrition Tracker

A small protein / calorie / saturated fat / fiber log, built as a static app and
deployed to GitHub Pages.

Entries are stored as `entries.json` in a **separate private repo**, so every
device shares one history — and a Custom GPT can log meals into it directly.

**Picking this up mid-project?** Start with [`docs/HANDOFF.md`](docs/HANDOFF.md).

**Setup (one time):** [`docs/SETUP.md`](docs/SETUP.md) — or run [`scripts/bootstrap-data-repo.sh`](scripts/bootstrap-data-repo.sh) to create the data repo in one command

- [`data-repo/`](data-repo/) — files to copy into the private data repo
- [`docs/chatgpt-action.json`](docs/chatgpt-action.json) — OpenAPI schema for the GPT Action
- [`docs/gpt-instructions.md`](docs/gpt-instructions.md) — instructions for the Custom GPT

## Development

```bash
npm install
npm run dev
```

Day boundaries are computed in `America/Chicago` in both the app
(`APP_TIME_ZONE` in `src/utils.ts`) and the logging workflow (`TIME_ZONE` in
`data-repo/scripts/append-entry.mjs`). Change both together.
