import { posix } from "node:path";
import { fillTemplate } from "../language/profiles.js";
import type { LanguageProfile } from "../language/types.js";

export function heredoc(path: string, body: string, tag: string): string {
  return "cat > " + path + " <<'" + tag + "'\n" + body.trimEnd() + "\n" + tag + "\n";
}

export function snapshotLines(id: string, phase: string, targets: readonly string[]): string {
  let out = "D=/tmp/morph/" + id + "-" + phase + "; mkdir -p $D; S=$(date +%s)-$$; L=$D/acc-$S.log\n";
  for (let i = 0; i < targets.length; i++) {
    const ext = posix.extname(targets[i]);
    out += "cp " + targets[i] + " $D/" + i + "-$S" + (ext === "" ? ".txt" : ext) + " 2>/dev/null\n";
  }
  return out;
}

export function wrapScript(id: string, phase: string, targets: readonly string[], body: string): string {
  return (
    snapshotLines(id, phase, targets) +
    "(\n set -e\n export NO_COLOR=1 CI=1\n" +
    body +
    ") > $L 2>&1; rc=$?; cat $L; exit $rc"
  );
}

export function tscStep(profile: LanguageProfile): string {
  return "echo '== tsc'; " + profile.parseLine + " -p $P/tsconfig.card.json\n";
}

export function eslintStep(profile: LanguageProfile, files: readonly string[]): string {
  return (
    "echo '== eslint'; E=0; " +
    fillTemplate(profile.lintLine, { files: files.join(" ") }) +
    " || E=1\n"
  );
}

export const ESLINT_VERDICT: string =
  '[ "$E" = 0 ] || { echo "== eslint failed (see above); every step between it and here passed"; exit 1; }\n';

export function vitestStep(profile: LanguageProfile, args: string): string {
  return (
    fillTemplate(profile.ownTestLine, { test: args }) +
    " > $P/vt.log 2>&1 || { " +
    "if grep -q '^ FAIL ' $P/vt.log; then awk '/^ FAIL /{p=1} p' $P/vt.log | grep -vE '^ +(Start at|Duration) ' | head -200; else tail -60 $P/vt.log; fi; " +
    "node $P/firstdiff.mjs $P/vt.log; exit 1; }\n"
  );
}

export function fullArgs(exclude: readonly string[]): string {
  let out = "--passWithNoTests";
  for (const path of exclude) {
    out += " --exclude " + path;
  }
  return out;
}

export function frozenStep(paths: readonly string[]): string {
  const p = paths.join(" ");
  return (
    "echo '== frozen'; git diff --quiet HEAD -- " +
    p +
    ' || { echo "changed outside the targets: $(git diff --name-only HEAD -- ' +
    p +
    ' | tr "\\n" " ")"; exit 1; }\n'
  );
}

export function untrackedStep(targets: readonly string[]): string {
  let e = "";
  for (let i = 0; i < targets.length; i++) {
    if (i > 0) {
      e += " ";
    }
    e += "-e " + targets[i];
  }
  return (
    "X=$(git ls-files --others --exclude-standard | grep -vxF " +
    e +
    ' || true); [ -z "$X" ] || { echo "files left in the tree: $X"; exit 1; }\n'
  );
}

const GIT_STATE =
  "(git symbolic-ref -q HEAD || true; git rev-parse HEAD; git for-each-ref --format='%(refname) %(objectname)') 2>&1)";

export const OWN_GIT_BEFORE: string = "G0=$( " + GIT_STATE + "\n";

export const OWN_GIT_AFTER: string =
  "echo '== own git'; G1=$( " +
  GIT_STATE +
  '; [ "$G0" = "$G1" ] || { echo "tests changed this repository\'s HEAD or refs:"; echo "before: $G0" | head -5; echo "after: $G1" | head -5; exit 1; }\n';

export function namesKept(file: string, drop: readonly string[]): string {
  let skip = "";
  for (const name of drop) {
    skip += " | grep -vxF " + JSON.stringify('"' + name + '"');
  }
  return (
    "echo '== names " +
    file +
    "'; git show HEAD:" +
    file +
    " | grep -oE '(test|it)\\(\"[^\"]+\"' | sed -E 's/^(test|it)\\(//'" +
    skip +
    " > $P/names || true; while IFS= read -r n; do grep -qF \"$n\" " +
    file +
    ' || { echo "test removed: $n"; exit 1; }; done < $P/names\n'
  );
}
