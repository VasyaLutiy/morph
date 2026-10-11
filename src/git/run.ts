import { spawnSync } from "node:child_process";
import type { GitResult } from "./types.js";

export function runGit(root: string, args: string[], env: Record<string, string>): GitResult {
  const result = spawnSync("git", args, {
    cwd: root,
    env: { ...env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
    encoding: "utf8",
    maxBuffer: 67108864,
  });
  if (result.error) {
    return { code: null, stdout: "", stderr: "git could not start: " + result.error.message };
  }
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function gitOk(root: string, args: string[], env: Record<string, string>): string {
  const result = runGit(root, args, env);
  if (result.code === 0) {
    return result.stdout;
  }
  const trimmed = result.stderr.trim();
  const firstLine = trimmed.split("\n", 1)[0] ?? "";
  throw new Error("git " + args[0] + " failed (exit " + String(result.code) + "): " + firstLine);
}
