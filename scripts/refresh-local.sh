#!/bin/bash
#
# The same refresh the hourly job on GitHub runs, but from this machine.
#
# Movieland and Jaffa Cinema answer a home connection and refuse a data centre, so the run on
# GitHub publishes a schedule without them. A run from here fills them in, and the runs on GitHub
# carry them forward until the next one (see src/scraper/carry.ts for how long). Nothing here works
# around anyone's protection: this is a home network asking a public page what a person would.
#
# It needs no paid service: Node, git, and the free TMDB key in .env.local.
#
# Enable it as a background job that succeeds once a day:
#   ./scripts/refresh-local.sh --install
# Stop it:
#   ./scripts/refresh-local.sh --uninstall
# Run it once, now:
#   ./scripts/refresh-local.sh
#
# The job wakes every hour (and when the Mac wakes), and does nothing if today's run has already
# succeeded. A day the Mac is off is simply a day without a run; the next morning it is on, it runs.
# "Succeeded" means the sources only this machine can reach were actually read: a run that could not
# reach them still publishes, but tries again an hour later.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
LABEL=il.seret-haerev.refresh
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG=/tmp/seret-haerev-refresh.log
# Kept inside .git: it belongs to this machine, not to the project.
STAMP="$(git rev-parse --absolute-git-dir)/refresh-local-ok"
TODAY=$(TZ=Asia/Jerusalem date +%F)
# The sources the run on GitHub cannot reach, by the label the scraper reports them under.
HOME_ONLY='["movieland","jaffa cinema"]'

install_job() {
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>-lc</string><string>exec "$ROOT/scripts/refresh-local.sh" --daily</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  echo "daily refresh enabled (checked hourly). log: $LOG"
  exit 0
}

uninstall_job() {
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "daily refresh disabled."
  exit 0
}

DAILY=no
case "${1:-}" in
  --install) install_job ;;
  --uninstall) uninstall_job ;;
  --daily) DAILY=yes ;;
  "") ;;
  *) echo "usage: $0 [--install|--uninstall|--daily]" >&2; exit 2 ;;
esac

# Once a day is enough: the schedules change weekly, and the hourly wake-up is only a retry.
if [ "$DAILY" = yes ] && [ "$(cat "$STAMP" 2>/dev/null || true)" = "$TODAY" ]; then
  exit 0
fi

# A snapshot this machine has edited by hand is not ours to overwrite or to publish.
SNAPSHOT_WAS_CLEAN=yes
git diff --quiet -- data/snapshot.json || SNAPSHOT_WAS_CLEAN=no
GEOCODE_WAS_CLEAN=yes
git diff --quiet -- data/geocode-cache.json || GEOCODE_WAS_CLEAN=no

echo "--- $(date -u +%Y-%m-%dT%H:%M:%SZ) refreshing from $(hostname -s)"

# Start from what is published, not from what happens to be in the tree: a source that fails is
# carried forward from the previous snapshot, and the published one is the fresher of the two.
# The branch is force-pushed as a single commit every time, so the local copy can never be
# fast-forwarded: without the "+" the fetch is refused. If it cannot be fetched at all (offline),
# stop: publishing from whatever this machine fetched last would put an old schedule back.
if ! git fetch -q origin +data:data; then
  echo "--- could not fetch the published data; not publishing" >&2
  exit 1
fi
for f in snapshot enrich-cache poster-cache geocode-cache summary-cache; do
  git show "data:$f.json" > "data/$f.json" 2>/dev/null || true
done

npm run --silent scrape
HOME_ONLY_READ=$(node -e '
  const s = require("./data/snapshot.json");
  const need = JSON.parse(process.argv[1]);
  process.stdout.write(need.every((n) => s.sources.some((r) => r.chain === n && r.ok)) ? "yes" : "no");
' "$HOME_ONLY")

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp data/snapshot.json data/enrich-cache.json data/poster-cache.json data/geocode-cache.json data/summary-cache.json "$STAGE/" 2>/dev/null || cp data/snapshot.json "$STAGE/"
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
[ "$GEOCODE_WAS_CLEAN" = yes ] && git checkout -q -- data/geocode-cache.json

if [ "$HOME_ONLY_READ" = yes ]; then
  echo "$TODAY" > "$STAMP"
  echo "--- published"
else
  echo "--- published, but a home-only source was not read; trying again in an hour"
fi
