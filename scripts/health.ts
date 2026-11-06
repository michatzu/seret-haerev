/**
 * Runs after the snapshot is published. Fails when this run raised a problem, which is what makes
 * GitHub send its owner an email: the schedule is already out, so failing here costs nothing and
 * is the one way a scheduled job can get a person's attention.
 *
 * Problems are raised once and then once a day while they last (src/scraper/health.ts), so this
 * fails on the run that notices, not on every run after it.
 */
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { Snapshot } from "@/lib/types";

async function main() {
  const snapshot = JSON.parse(await readFile(path.join(process.cwd(), "data", "snapshot.json"), "utf8")) as Snapshot;
  const health = snapshot.health;
  if (!health) {
    console.log("health: no health record in the snapshot");
    return;
  }
  const raised = new Set(health.alerts);
  for (const p of health.problems) console.log(`${raised.has(p) ? "RAISED " : "ongoing"} ${p}`);
  if (!health.problems.length) console.log("health: every source read, nothing dropped");

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary && health.problems.length) {
    const lines = ["## Source health", "", ...health.problems.map((p) => `- ${raised.has(p) ? "**new** " : ""}${p}`), ""];
    await appendFile(summary, lines.join("\n"));
  }
  if (health.alerts.length) {
    for (const a of health.alerts) console.log(`::error title=Source health::${a.replace(/\r?\n/g, " ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
