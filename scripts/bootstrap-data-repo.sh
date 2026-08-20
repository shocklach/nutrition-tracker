#!/usr/bin/env bash
# Creates the private data repo and pushes the storage files into it.
#
# Requires the GitHub CLI, authenticated as the repo owner:
#   brew install gh && gh auth login
#
# Safe to re-run: it skips creation if the repo already exists.

set -euo pipefail

OWNER="${OWNER:-shocklach}"
REPO="${REPO:-nutrition-log}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../data-repo"

if [ ! -f "$SOURCE_DIR/entries.json" ]; then
  echo "Could not find data-repo/ next to this script." >&2
  exit 1
fi

if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "Repo $OWNER/$REPO already exists — reusing it."
else
  echo "Creating private repo $OWNER/$REPO..."
  gh repo create "$OWNER/$REPO" --private --description "Private data store for the nutrition tracker app"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone "https://github.com/$OWNER/$REPO.git" "$WORK/repo" 2>/dev/null || {
  echo "Clone failed. Check that gh is authenticated: gh auth status" >&2
  exit 1
}

cp -R "$SOURCE_DIR/." "$WORK/repo/"

cd "$WORK/repo"
git add .

if git diff --cached --quiet; then
  echo "Nothing to push — files already up to date."
  exit 0
fi

git commit -m "Set up nutrition log storage"
git push -u origin HEAD

echo
echo "Done. $OWNER/$REPO now contains:"
git ls-files | sed 's/^/  /'
echo
echo "Confirm it is PRIVATE: https://github.com/$OWNER/$REPO/settings"
