import { posix } from "node:path";
import { codeTargets, hasExtension, testTarget } from "../language/paths.js";
import { allowArg, litsJson } from "./compose.js";
import { frozenStep, heredoc, OWN_GIT_AFTER, OWN_GIT_BEFORE, untrackedStep, wrapScript } from "./steps.js";
import type { CardContext, JudgeFile } from "./types.js";

export const GO_ENV: string =
  'export GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"\n';

export const GO_ENV_VENDOR: string =
  'export GOFLAGS=-mod=vendor GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"\n';

export function goEnv(vendor: boolean): string {
  return vendor ? GO_ENV_VENDOR : GO_ENV;
}

export const GO_LINT_VERDICT: string =
  '[ "$E" = 0 ] || { echo "== vet or gofmt failed (see above); every step between it and here passed"; exit 1; }\n';

export function goPackages(paths: readonly string[]): string[] {
  const out: string[] = [];
  for (const path of paths) {
    const dir = posix.dirname(path);
    const pkg = dir === "." ? "." : "./" + dir;
    if (!out.includes(pkg)) {
      out.push(pkg);
    }
  }
  return out;
}

export function overlayJson(hidden: readonly string[]): string {
  const replace: Record<string, string> = {};
  for (const path of hidden) {
    if (path.endsWith(".go")) {
      replace[path] = "";
    }
  }
  return JSON.stringify({ Replace: replace }) + "\n";
}

export function goProbePath(id: string, code: string): string {
  const dir = posix.dirname(code);
  return dir === "." ? id + "_probe_test.go" : dir + "/" + id + "_probe_test.go";
}

export function goDir(
  id: string,
  guard: string,
  firstdiff: string,
  siblings: readonly string[],
  fullExclude: readonly string[],
  probePath: string | null,
): string {
  return (
    "P=$PWD/probe/" + id + "; rm -rf $P; mkdir -p $P; trap 'rm -rf $P" +
    (probePath !== null ? " " + probePath : "") +
    "' EXIT\n" +
    heredoc("$P/guard.mjs", guard, "MORPH_GUARD_EOF") +
    heredoc("$P/firstdiff.mjs", firstdiff, "MORPH_FIRSTDIFF_EOF") +
    heredoc("$P/overlay.json", overlayJson(siblings), "MORPH_CONF_EOF") +
    heredoc("$P/full.json", overlayJson(fullExclude), "MORPH_CONF_EOF")
  );
}

export function goTestStep(args: string): string {
  return (
    "go test -count=1 " +
    args +
    " > $P/gt.log 2>&1 || { if grep -q '^--- FAIL' $P/gt.log; then awk '/^--- FAIL/{p=1} p' $P/gt.log | grep -vE '^(ok[[:space:]]|PASS$|FAIL$)' | head -200; else tail -60 $P/gt.log; fi; node $P/firstdiff.mjs $P/gt.log; exit 1; }\n"
  );
}

export function goLintSteps(targets: readonly string[]): string {
  const files = targets.filter((t) => t.endsWith(".go"));
  const list = files.join(" ");
  return (
    "echo '== vet'; E=0; go vet -overlay $P/overlay.json " +
    goPackages(files).join(" ") +
    " || E=1\n" +
    "echo '== gofmt'; F=$(gofmt -l " +
    list +
    ' 2>&1) || true; [ -z "$F" ] || { echo "gofmt -l lists: $F"; gofmt -d ' +
    list +
    " 2>&1 | head -60; E=1; }\n"
  );
}

export function goNamesKept(file: string, drop: readonly string[]): string {
  let skip = "";
  for (const name of drop) {
    skip += " | grep -vxF " + JSON.stringify(name);
  }
  return (
    "echo '== names " +
    file +
    "'; git show HEAD:" +
    file +
    " | grep -oE '^func Test[A-Za-z0-9_]*' | sed -E 's/^func //'" +
    skip +
    " > $P/names || true; while IFS= read -r n; do grep -qE \"^func $n\\(\" " +
    file +
    ' || { echo "test removed: $n"; exit 1; }; done < $P/names\n'
  );
}

export function goCodeAcceptance(
  ctx: CardContext,
  probe: string,
  smoke: number | null,
  extra: string | null,
): string {
  const code = codeTargets(ctx.profile, ctx.targets);
  const test = smoke !== null ? testTarget(ctx.profile, ctx.targets) : null;
  const probePath = goProbePath(ctx.id, code[0]);
  let body = goEnv(ctx.vendor === true);
  body += goDir(ctx.id, ctx.guard, ctx.firstdiff, ctx.siblings, ctx.fullExclude, probePath);
  if (ctx.ownGit) {
    body += OWN_GIT_BEFORE;
  }
  body += "echo '== build'; go build -overlay $P/overlay.json " + goPackages(code).join(" ") + "\n";
  body += goLintSteps(ctx.targets.filter((t) => hasExtension(ctx.profile, t)));
  body += "echo '== guard'; node $P/guard.mjs src " + code.join(",") + allowArg(ctx.allowed ?? []);
  if (test !== null && smoke !== null) {
    body += "; node $P/guard.mjs tests " + test + " 1 " + smoke;
  }
  body += "\n";
  body += "echo '== probe'; " + heredoc(probePath, probe, "MORPH_PROBE_EOF");
  body += goTestStep("-overlay $P/overlay.json -run '^TestProbe' " + goPackages([probePath]).join(" "));
  body += "rm -f " + probePath + "\n";
  if (test !== null && smoke !== null) {
    body += "echo '== own'; " + goTestStep("-overlay $P/overlay.json " + goPackages([test]).join(" "));
  }
  body += GO_LINT_VERDICT;
  if (extra !== null) {
    body += extra;
  }
  body += "echo '== full'; " + goTestStep("-overlay $P/full.json ./...");
  if (ctx.ownGit) {
    body += OWN_GIT_AFTER;
  }
  body += frozenStep(ctx.frozen);
  body += untrackedStep(ctx.targets);
  return wrapScript(ctx.id, ctx.phase, ctx.targets, body);
}

export function goJudgeAcceptance(ctx: CardContext, files: readonly JudgeFile[]): string {
  let body = goEnv(ctx.vendor === true);
  body += goDir(ctx.id, ctx.guard, ctx.firstdiff, ctx.siblings, ctx.fullExclude, null);
  if (ctx.ownGit) {
    body += OWN_GIT_BEFORE;
  }
  body += goLintSteps(ctx.targets);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    body += heredoc("$P/lits" + i + ".json", litsJson(f.lits), "MORPH_LITS_EOF");
    body +=
      "echo '== guard " +
      f.file +
      "'; node $P/guard.mjs tests " +
      f.file +
      " " +
      f.min +
      " " +
      f.max +
      " $P/lits" +
      i +
      ".json\n";
  }
  for (const f of files) {
    if (!f.new) {
      body += goNamesKept(f.file, f.drop);
    }
  }
  body += "echo '== own'; " + goTestStep("-overlay $P/overlay.json " + goPackages(ctx.targets).join(" "));
  body += GO_LINT_VERDICT;
  body += "echo '== full'; " + goTestStep("-overlay $P/full.json ./...");
  if (ctx.ownGit) {
    body += OWN_GIT_AFTER;
  }
  body += frozenStep(ctx.frozen);
  body += untrackedStep(ctx.targets);
  return wrapScript(ctx.id, ctx.phase, ctx.targets, body);
}
