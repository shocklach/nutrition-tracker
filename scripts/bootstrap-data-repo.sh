#!/usr/bin/env bash
# Creates the private data repo for the nutrition tracker and pushes the
# storage files into it.
#
# Run from inside a clone of the nutrition-tracker repo:
#   ./scripts/bootstrap-data-repo.sh
#
# Safe to re-run: skips creation if the repo exists, skips the push if the
# files are already up to date.

set -euo pipefail

OWNER="${OWNER:-shocklach}"
REPO="${REPO:-nutrition-log}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../data-repo"

if [ ! -f "$SOURCE_DIR/entries.json" ]; then
  cat >&2 <<'MSG'
Could not find data-repo/ next to this script.

Run this from inside a clone of the nutrition-tracker repo:

  git clone -b claude/chatgpt-nutrition-tracker-fzbx4o \
    https://github.com/shocklach/nutrition-tracker.git
  cd nutrition-tracker
  ./scripts/bootstrap-data-repo.sh
MSG
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  cat >&2 <<'MSG'
The GitHub CLI (gh) is not installed.

Install it:

  brew install gh
  gh auth login

Then re-run this script.

Alternatively, create the repo by hand at https://github.com/new
(name: nutrition-log, Private, tick "Add a README"), install gh as above,
and re-run — the script will reuse the repo you created.
MSG
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is installed but not signed in. Run: gh auth login" >&2
  exit 1
fi

if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "Repo $OWNER/$REPO already exists — reusing it."
else
  echo "Creating private repo $OWNER/$REPO..."
  gh repo create "$OWNER/$REPO" \
    --private \
    --add-readme \
    --description "Private data store for the nutrition tracker app"
fi

# Refuse to write health data into a public repo.
VISIBILITY="$(gh repo view "$OWNER/$REPO" --json visibility --jq .visibility)"
if [ "$VISIBILITY" != "PRIVATE" ]; then
  echo "Refusing to continue: $OWNER/$REPO is $VISIBILITY, not PRIVATE." >&2
  echo "Make it private at https://github.com/$OWNER/$REPO/settings" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Cloning $OWNER/$REPO..."
gh repo clone "$OWNER/$REPO" "$WORK/repo" -- --quiet

cp -R "$SOURCE_DIR/." "$WORK/repo/"

cd "$WORK/repo"
git add .

if git diff --cached --quiet; then
  echo "Nothing to push — files already up to date."
else
  git commit -q -m "Set up nutrition log storage"
  git push -q -u origin HEAD
  echo "Pushed."
fi

echo
echo "$OWNER/$REPO now contains:"
git ls-files | sed 's/^/  /'
echo
echo "Next: create two fine-grained tokens (Contents: Read and write, scoped to"
echo "$REPO) at https://github.com/settings/personal-access-tokens/new"
