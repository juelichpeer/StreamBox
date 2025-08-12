#!/usr/bin/env bash
set -e

# go to this script's folder
cd "$(dirname "$0")"

# default message if none entered
msg="${1:-chore: quick deploy}"

echo "→ Adding changes…"
git add -A

echo "→ Committing…"
git commit -m "$msg" || git commit --allow-empty -m "$msg"

echo "→ Pushing…"
git push

echo "✓ Done. Netlify will redeploy automatically."
