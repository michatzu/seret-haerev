#!/bin/bash
#
# The same refresh the hourly job on GitHub runs, but from this machine.
#
# Movieland answers a home connection and refuses a data centre, so the run on GitHub publishes a
# schedule with its seven cinemas missing. A run from here fills them in, and the next runs on
# GitHub carry them forward for a day — which is as long as a schedule nobody has re-read is worth
# trusting. Nothing here works around anyone's protection: this is a browser's own network asking
# a public page the same question a person would.
#
# Enable it as an hourly background job:
#   ./scripts/refresh-local.sh --install
# Stop it:
#   ./scripts/refresh-local.sh --uninstall
# Run it once, now:
#   ./scripts/refresh-local.sh

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
LABEL=il.seret-haerev.refresh
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG=/tmp/seret-haerev-refresh.log

install_job() {
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>-lc</string><string>exec "$ROOT/scripts/refresh-local.sh"</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  echo "hourly refresh enabled. log: $LOG"
  exit 0
}

uninstall_job() {
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "hourly refresh disabled."
  exit 0
}

case "${1:-}" in
  --install) install_job ;;
  --uninstall) uninstall_job ;;
  "") ;;
  *) echo "usage: $0 [--install|--uninstall]" >&2; exit 2 ;;
esac

# A snapshot this machine has edited by hand is not ours to overwrite or to publish.
SNAPSHOT_WAS_CLEAN=yes
git diff --quiet -- data/snapshot.json || SNAPSHOT_WAS_CLEAN=no

echo "--- $(date -u +%Y-%m-%dT%H:%M:%SZ) refreshing from $(hostname -s)"

# Start from what is published, not from what happens to be in the tree: a source that fails is
# carried forward from the previous snapshot, and the published one is the fresher of the two.
git fetch -q origin data:data 2>/dev/null || true
for f in snapshot enrich-cache poster-cache geocode-cache; do
  git show "data:$f.json" > "data/$f.json" 2>/dev/null || true
done

npm run --silent scrape

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp data/snapshot.json data/enrich-cache.json data/poster-cache.json data/geocode-cache.json "$STAGE/" 2>/dev/null || cp data/snapshot.json "$STAGE/"
# this branch holds data, not an app: tell Vercel not to try to build it
cp vercel.json "$STAGE/"
(
  cd "$STAGE"
  git init -q -b data
  git config user.name "seret-haerev bot"
  git config user.email "bot@users.noreply.github.com"
  git add -A
  git commit -q -m "data: $(date -u +%Y-%m-%dT%H:%MZ) (local)"
  git push -q --force "$(git -C "$ROOT" remote get-url origin)" data
)

# Leave the working tree as it was found.
[ "$SNAPSHOT_WAS_CLEAN" = yes ] && git checkout -q -- data/snapshot.json
echo "--- published"
