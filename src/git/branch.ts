import { runGit, gitOk } from "./run.js";
import type { BranchResult } from "./types.js";

export function openRunBranch(
  root: string,
  runId: string,
  env: Record<string, string>,
): BranchResult {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    return { ok: false, error: "invalid runId: " + runId };
  }
  const status = gitOk(root, ["status", "--porcelain", "--untracked-files=all"], env);
  const dirty: string[] = [];
  for (const line of status.split("\n")) {
    if (line === "") continue;
    let p = line.slice(3);
    const arrow = p.indexOf(" -> ");
    if (arrow !== -1) {
      p = p.slice(arrow + " -> ".length);
    }
    if (!p.startsWith(".morph/")) {
      dirty.push(p);
    }
  }
  if (dirty.length > 0) {
    return { ok: false, error: "dirty tree outside .morph/: " + dirty.sort().join(", ") };
  }
  const base = gitOk(root, ["rev-parse", "HEAD"], env).trim();
  const existing = runGit(
    root,
    ["rev-parse", "--verify", "--quiet", "refs/heads/morph/" + runId],
    env,
  );
  if (existing.code === 0) {
    return { ok: false, error: "branch morph/" + runId + " already exists" };
  }
  gitOk(root, ["checkout", "-q", "-b", "morph/" + runId], env);
  return { ok: true, branch: "morph/" + runId, base };
}
