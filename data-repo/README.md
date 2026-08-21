# Nutrition log (data repo template)

Copy the contents of this directory into a **separate private** GitHub repo —
it is the storage backend for the nutrition tracker app, not part of the app.

```
entries.json                      every logged entry
scripts/append-entry.mjs          validates a payload and appends one entry
.github/workflows/log-entry.yml   repository_dispatch handler for ChatGPT
```

Two writers share `entries.json`:

- **the app**, over the GitHub Contents API, using a token stored on each device
- **ChatGPT**, by triggering the `log-entry` workflow via `repository_dispatch`
  and checking that the matching workflow run completed successfully

Both handle write conflicts, so concurrent logs merge rather than clobber.

Keep this repo **private**. It contains your health data.

Full instructions: see `docs/SETUP.md` in the app repo.

## Payload shape

```bash
curl -X POST https://api.github.com/repos/OWNER/REPO/dispatches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{
        "event_type": "log-entry",
        "client_payload": {
          "entryId": "meal-20260821-184500-a1b2c3",
          "proteinGrams": 42,
          "calories": 610,
          "saturatedFatGrams": 6.5,
          "fiberGrams": 9.2,
          "note": "Chicken burrito bowl"
        }
      }'
```

`dateKey` is optional and only for backdating; omit it and the workflow stamps
today's date in US Central time.

`entryId` is required for ChatGPT requests. Reusing the same ID makes retries
idempotent: the workflow succeeds without adding a second copy. The workflow
run is named `Log entry <entryId>`, so its `status` and `conclusion` can be
checked through GitHub's workflow-runs API before ChatGPT says "Logged."
