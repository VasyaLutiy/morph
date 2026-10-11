import { codeTargets, testTarget } from "../language/paths.js";
import { heredoc, OWN_GIT_AFTER, OWN_GIT_BEFORE, eslintStep, ESLINT_VERDICT, frozenStep, namesKept, tscStep, untrackedStep, vitestStep, fullArgs, wrapScript } from "./steps.js";
import { probeDir } from "./probeDir.js";
import type { CardContext, JudgeFile } from "./types.js";

export function litsJson(lits: readonly string[]): string {
  return "[" + lits.map((lit) => JSON.stringify(lit)).join(", ") + "]";
}

export function allowArg(allowed: readonly string[]): string {
  return allowed.length === 0 ? "" : " '" + allowed.join(",") + "'";
}

export function codeAcceptance(
  ctx: CardContext,
  probe: string,
  smoke: number | null,
  extra: string | null,
): string {
  const code = codeTargets(ctx.profile, ctx.targets);
  const test = smoke !== null ? testTarget(ctx.profile, ctx.targets) : null;
  let body = probeDir(ctx.id, ctx.guard, ctx.firstdiff, probe, ctx.siblings);
  if (ctx.ownGit) {
    body += OWN_GIT_BEFORE;
  }
  body += tscStep(ctx.profile);
  body += eslintStep(ctx.profile, ctx.targets);
  body += "echo '== guard'; node $P/guard.mjs src " + code.join(",") + allowArg(ctx.allowed ?? []);
  if (test !== null) {
    body += "; node $P/guard.mjs tests " + test + " 1 " + smoke;
  }
  body += "\n";
  body += "echo '== probe'; " + vitestStep(ctx.profile, "--config $P/probe.config.mts");
  if (test !== null) {
    body += "echo '== own'; " + vitestStep(ctx.profile, test);
  }
  body += ESLINT_VERDICT;
  if (extra !== null) {
    body += extra;
  }
  body += "echo '== full'; " + vitestStep(ctx.profile, fullArgs(ctx.fullExclude));
  if (ctx.ownGit) {
    body += OWN_GIT_AFTER;
  }
  body += frozenStep(ctx.frozen);
  body += untrackedStep(ctx.targets);
  return wrapScript(ctx.id, ctx.phase, ctx.targets, body);
}

export function judgeAcceptance(ctx: CardContext, files: readonly JudgeFile[]): string {
  let body = probeDir(ctx.id, ctx.guard, ctx.firstdiff, null, ctx.siblings);
  if (ctx.ownGit) {
    body += OWN_GIT_BEFORE;
  }
  body += tscStep(ctx.profile);
  body += eslintStep(ctx.profile, ctx.targets);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    body += heredoc("$P/lits" + i + ".json", litsJson(f.lits), "MORPH_LITS_EOF");
    body +=
      "echo '== guard " + f.file + "'; node $P/guard.mjs tests " + f.file + " " + f.min + " " + f.max + " $P/lits" + i + ".json\n";
  }
  for (const f of files) {
    if (!f.new) {
      body += namesKept(f.file, f.drop);
    }
  }
  body += "echo '== own'; " + vitestStep(ctx.profile, ctx.targets.join(" "));
  body += ESLINT_VERDICT;
  body += "echo '== full'; " + vitestStep(ctx.profile, fullArgs(ctx.fullExclude));
  if (ctx.ownGit) {
    body += OWN_GIT_AFTER;
  }
  body += frozenStep(ctx.frozen);
  body += untrackedStep(ctx.targets);
  return wrapScript(ctx.id, ctx.phase, ctx.targets, body);
}
