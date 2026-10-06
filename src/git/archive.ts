import fs from "node:fs";
import path from "node:path";
import { commitPaths } from "./commit.js";
import type { ArchiveInput, ArchiveResult, Trailer } from "./types.js";

function countByStatus(outcomes: { status: string }[], status: string): string {
  let n = 0;
  for (const o of outcomes) {
    if (o.status === status) {
      n += 1;
    }
  }
  return String(n);
}

export function archiveRun(
  root: string,
  input: ArchiveInput,
  env: Record<string, string>
): ArchiveResult {
  if (!/^[A-Za-z0-9._-]+$/.test(input.runId)) {
    return { ok: false, error: "invalid runId: " + input.runId };
  }
  const dir = ".morph/runs/" + input.runId;
  if (fs.existsSync(path.join(root, dir))) {
    return { ok: false, error: "archive " + dir + " already exists" };
  }
  fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(
    path.join(root, dir, "deck.json"),
    JSON.stringify(input.deck.cards, null, 2) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, dir, "report.json"),
    JSON.stringify(input.report, null, 2) + "\n",
    "utf8"
  );
  const trailers: Trailer[] = [
    ["Morph-Run", input.runId],
    ["Morph-Cards", String(input.deck.cards.length)],
    ["Morph-Written", countByStatus(input.report.outcomes, "written")],
    ["Morph-Failed", countByStatus(input.report.outcomes, "failed")],
    ["Morph-Skipped", countByStatus(input.report.outcomes, "skipped")],
    ["Morph-Budget-Exceeded", countByStatus(input.report.outcomes, "budget-exceeded")]
  ];
  try {
    const info = commitPaths(
      root,
      [dir + "/deck.json", dir + "/report.json"],
      "morph run " + input.runId + ": deck and report",
      trailers,
      env
    );
    return { ok: true, dir, commit: info === null ? null : info.commit };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: "archive " + dir + " written but not committed: " + message };
  }
}
